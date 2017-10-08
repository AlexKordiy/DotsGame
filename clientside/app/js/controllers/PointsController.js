pointsApp.controller('PointsController', function ($scope) {
    $scope.points_count = 16;
    $scope.cell_size = 40;

    $scope.canvas = angular.element(document.querySelector(".gamefield"))[0];
    $scope.context = $scope.canvas.getContext("2d");

    let socket = new WebSocket("ws://localhost:8081");
    let tamplate = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];

    let ChainList = [];
    let surrounded = [];

    $scope.Score = {
        first: 0,
        second: 0
    };

    let Gamer = {
        turn: false,
        pair: false,
        marker: 0,
        fillStyle: '',
        connected: false
    };

    class Chain {
        constructor(Marker) {
            this.Points = [];
            this.First = undefined;
            this.Marker = Marker;
            this.isPolygon = false;
            this.PolyPath = [];
        }
        Join(i, j) {
            if (this.First === undefined) {
                this.First = [i, j];
            }
            else this.Points.push([i, j]);
        }
        Contains(pattern) {
            let jarray = JSON.stringify(this.Points);
            let jpattern = JSON.stringify(pattern);

            return jarray.includes(jpattern);
        }
        isFirst(pattern) {
            let jfirst = JSON.stringify(this.First);
            let jpattern = JSON.stringify(pattern);

            return jfirst == jpattern;
        }
        SetPolygon(value) {
            this.isPolygon = value;
            return this;

        }
        setPath() {
            function PathScan(value) {
                let Points = value;
                function rotate(A, B, C) {
                    return (B[0] - A[0]) * (C[1] - B[1]) - (B[1] - A[1]) * (C[0] - B[0]);
                }
                function Swap(Points) {
                    let P = Points;
                    for (let i = 0; i < Points.length; i++) {
                        if (Points[i][0] < Points[0][0]) {
                            let tmp = P[i];
                            P[i] = P[0];
                            P[0] = tmp;
                        }
                    }
                    return P;
                }
                let P = Swap(Points);
                let H = [P[0]];
                P.splice(0, 1);
                P.push(H[0]);
                for (let i = 2; i < Points.length; i++) {
                    let j = i;
                    while (j > 1 && (rotate(P[0], P[j - 1], P[j]) < 0)) {
                        let tmp = P[j];
                        P[j] = P[j - 1];
                        P[j - 1] = tmp;
                        j -= 1
                    }
                }
                let S = [P[0], P[1]];
                for (let i = 2; i < Points.length; i++) {
                    while (rotate(S[S.length - 2], S[S.length - 1], P[i]) < 0) {
                        S.splice(S.length - 1);
                    }
                    S.push(P[i]);
                }
                console.log('S: ', S);
                return S;
            }
            if (this.Points.length > 0)
                this.PolyPath = PathScan(this.Points);

            return this;
        }
    }

    class Point {
        constructor() {
            this.Position = {
                i: 0,
                j: 0
            }
            this.Neighbor = {
                i: 0,
                j: 0
            }
        }
        SetPosition(i, j) {
            this.Position.i = i;
            this.Position.j = j;

            return this;
        }
        SetNeighbor(i, j) {
            this.Neighbor.i = i;
            this.Neighbor.j = j;

            return this;
        }
    }

    $scope.make_a_step = function (event) {
        console.log(Gamer.turn);
        if (Gamer.connected) {
            if (Gamer.pair) {
                if (Gamer.turn) {
                    let mouseX = event.clientX - $scope.context.canvas.offsetLeft;
                    let mouseY = event.clientY - $scope.context.canvas.offsetTop;
                    let interval = 7;
                    let success = draw(mouseX, mouseY, interval, Gamer.fillStyle, Gamer.marker);
                    if (success == true) {
                        send_a_step(mouseX, mouseY, interval, Gamer.fillStyle, Gamer.marker);
                        Gamer.turn = false;
                    }
                }
                else alert('Пожалуйста дождитесь завершения хода соперника!');
            }
            else alert('Пожалуйста дождитесь подключения соперника!');
        }
        else alert('Вы не подключены к серверу попробуйте переподключится!');

    }

    function polygon_draw(Points, Marker) {
        $scope.context.strokeStyle = (Marker % 2 == 0) ? 'blue' : 'red';
        $scope.context.lineWidth = 5;
        $scope.context.beginPath();
        $scope.context.moveTo($scope.points[Points[0][0]], $scope.points[Points[0][1]]);
        for (let i = 1; i < Points.length; i++) {
            $scope.context.lineTo($scope.points[Points[i][0]], $scope.points[Points[i][1]]);
            if (Points[i + 1] === undefined) {
                $scope.context.lineTo($scope.points[Points[0][0]], $scope.points[Points[0][1]]);
            }
        }
        $scope.context.closePath();
        $scope.context.stroke();
        $scope.context.strokeStyle = 'black';
        $scope.context.lineWidth = 1;
    }

    function polygon_check(PointObj, ChainObj) {
        if (!ChainObj.Contains([PointObj.Neighbor.i, PointObj.Neighbor.j])) {
            if (!ChainObj.isFirst([PointObj.Neighbor.i, PointObj.Neighbor.j]))
                neighbors_check(PointObj.Neighbor.i, PointObj.Neighbor.j, ChainObj);
            else
                ChainObj.Join(PointObj.Neighbor.i, PointObj.Neighbor.j);
        }
        else if (ChainObj.Contains([PointObj.Neighbor.i, PointObj.Neighbor.j]) &&
            ChainObj.isFirst([PointObj.Neighbor.i, PointObj.Neighbor.j])) {
            if (!ContainsArr(ChainList, ChainObj) && ChainObj.Points.length >= 4) {
                ChainObj.setPath()
                    .SetPolygon(IsChainOfNeighbors(ChainObj));
                if (ChainObj.isPolygon) {
                    console.log('Polygon');
                    ChainList.push(ChainObj);
                }
            }
        }
    }

    function IsPointInsidePolygon(x, y, Points) {
        let i1, i2, n, N, S, S1, S2, S3, flag;
        N = Points.length;
        for (n = 0; n < N; n++) {
            flag = 0;
            i1 = n < N - 1 ? n + 1 : 0;
            while (flag == 0) {
                i2 = i1 + 1;
                if (i2 >= N)
                    i2 = 0;
                if (i2 == (n < N - 1 ? n + 1 : 0))
                    break;
                S = Math.abs(Points[i1][0] * (Points[i2][1] - Points[n][1]) +
                    Points[i2][0] * (Points[n][1] - Points[i1][1]) +
                    Points[n][0] * (Points[i1][1] - Points[i2][1]));
                S1 = Math.abs(Points[i1][0] * (Points[i2][1] - y) +
                    Points[i2][0] * (y - Points[i1][1]) +
                    x * (Points[i1][1] - Points[i2][1]));
                S2 = Math.abs(Points[n][0] * (Points[i2][1] - y) +
                    Points[i2][0] * (y - Points[n][1]) +
                    x * (Points[n][1] - Points[i2][1]));
                S3 = Math.abs(Points[i1][0] * (Points[n][1] - y) +
                    Points[n][0] * (y - Points[i1][1]) +
                    x * (Points[i1][1] - Points[n][1]));
                if (S == S1 + S2 + S3) {
                    flag = 1;
                    break;
                }
                i1 = i1 + 1;
                if (i1 >= N)
                    i1 = 0;
            }
            if (flag == 0)
                break;
        }
        return (flag == 0) ? false : true;
    }

    function IsNeighbor(Point) {
        let Marker = $scope.points_position[Point.Position.i][Point.Position.j];

        for (let i = 0; i < tamplate.length; i++) {
            if (Point.Neighbor.i + tamplate[i][0] == Point.Position.i && Point.Neighbor.j + tamplate[i][1] == Point.Position.j) {
                return true;
            }
        }
        return false;
    }

    function IsChainOfNeighbors(ChainObj) {
        if (ChainObj.PolyPath.length > 0) {
            let isPoligon = IsNeighbor(new Point()
                .SetPosition(ChainObj.PolyPath[0][0], ChainObj.PolyPath[0][1])
                .SetNeighbor(ChainObj.PolyPath[ChainObj.PolyPath.length - 1][0], ChainObj.PolyPath[ChainObj.PolyPath.length - 1][1]));
            let LockedChain = true;
            for (let i = 1; i < ChainObj.PolyPath.length; i++) {
                let Current = new Point()
                    .SetPosition(ChainObj.PolyPath[i][0], ChainObj.PolyPath[i][1])
                    .SetNeighbor(ChainObj.PolyPath[i - 1][0], ChainObj.PolyPath[i - 1][1]);

                if (IsNeighbor(Current) == false)
                    return false;
            }
            if (isPoligon && LockedChain)
                return true;
            else return false;
        }
        else return false;
    }

    function neighbors_check(i, j, ChainObj) {

        if (!ChainObj.Contains([i, j]) && !ChainObj.isFirst([i, j]) && $scope.points_position[i][j] == ChainObj.Marker
            && !ContainsArr(surrounded, [i, j])) {
            ChainObj.Join(i, j);

            for (let y = 0; y < tamplate.length; y++) {
                if ($scope.points_position[i + 1] !== undefined) {
                    if ($scope.points_position[i + tamplate[y][0]][j + tamplate[y][1]] !== undefined &&
                        $scope.points_position[i + tamplate[y][0]][j + tamplate[y][1]] == ChainObj.Marker) {

                        polygon_check(new Point()
                            .SetPosition(i, j)
                            .SetNeighbor(i + tamplate[y][0], j + tamplate[y][1]), ChainObj);
                    }
                }
            }
        }
        else {
            ChainObj = new Chain(ChainObj.Marker);
            return;
        }
        return ChainObj;
    }

    function send_a_step(mouseX, mouseY, interval, fillStyle, marker) {
        socket.send(JSON.stringify({
            cmd: 'make_a_step',
            value: {
                mouseX: mouseX,
                mouseY: mouseY,
                interval: interval,
                fillStyle: fillStyle,
                marker: marker
            }
        }));
    }

    function check_game_field() {
        if (ContainsArr($scope.points_position, 0))
            return true;
        else
            return false;
    }

    function CheckPoint(i, j, marker) {
        let poly = neighbors_check(i, j, new Chain(marker));
        let oponent = (marker % 2 == 0) ? 1 : 2;
        console.log('poly: ', poly);
        if (poly.isPolygon) {
            for (let ii = 0; ii < $scope.points_count; ii++) {
                for (let jj = 0; jj < $scope.points_count; jj++) {
                    if ($scope.points_position[ii][jj] == oponent) {
                        let hassurr = false;
                        if (IsPointInsidePolygon(ii, jj, poly.Points) && !ContainsArr(surrounded, [ii, jj])) {
                            surrounded.push([ii, jj]);
                            console.log('inPoly: true', ii, jj);
                            hassurr = true;
                            switch (poly.Marker) {
                                case 1: $scope.Score.first++;
                                    break;
                                case 2: $scope.Score.second++;
                                    break;
                            }
                        }
                        if (hassurr)
                            polygon_draw(poly.PolyPath, poly.Marker);
                    }
                }
            }
        }
    }

    function draw(mouseX, mouseY, interval, fillStyle, marker) {
        if (check_game_field()) {
            for (let i = 0; i < $scope.points_count; i++) {
                for (let j = 0; j < $scope.points_count; j++) {
                    if (mouseX < (i * $scope.cell_size) + interval &&
                        mouseX > (i * $scope.cell_size) - interval &&
                        mouseY < (j * $scope.cell_size) + interval &&
                        mouseY > (j * $scope.cell_size) - interval) {

                        if ($scope.points_position[i][j] != 2 && $scope.points_position[i][j] != 1) {
                            $scope.context.beginPath();

                            $scope.context.arc($scope.points[i], $scope.points[j], 12, 0, 2 * Math.PI);
                            $scope.context.fillStyle = fillStyle;
                            $scope.context.fill();
                            $scope.context.stroke();
                            $scope.points_position[i][j] = marker;
                            $scope.context.fillStyle = 'white';
                            $scope.context.font = '16px arial';
                            $scope.context.fillText($scope.points_position[i][j], $scope.points[i] - 3.5, $scope.points[j] + 3.5);

                            CheckPoint(i, j, marker);
                            console.log($scope.points_position);
                            return true;
                        }
                    }
                }
            }
        }
        else {
            if ($scope.Score.first > $scope.Score.second) {
                alert("Игра окончена, победил красный игрок!");
            } else if ($scope.Score.first < $scope.Score.second) {
                alert("Игра окончена, победил синий игрок!");
            }
            else if ($scope.Score.first == $scope.Score.second) {
                alert("Игра окончена, ничья!");
            }
        }
    }

    socket.onmessage = function (event) {
        let params = JSON.parse(event.data);
        switch (params.cmd) {
            case 'settings':
                Gamer = params.value.Gamer;
                console.log(params.value);
                break;

            case 'join':
                Gamer.pair = params.value;
                alert('Cоперник подключился. Ваш ход!');
                break;

            case 'unpair':
                Gamer = params.value.Gamer;
                alert(params.value.text);
                break;
            case 'make_a_step':
                draw(
                    params.value.mouseX,
                    params.value.mouseY,
                    params.value.interval,
                    params.value.fillStyle,
                    params.value.marker
                );
                Gamer.turn = true;
                console.log(Gamer);
                break;
            case 'full':
                alert(params.value);
                break;
        }
    };

    function ContainsArr(array, pattern) {
        let jarray = JSON.stringify(array);
        let jpattern = JSON.stringify(pattern);

        return jarray.includes(jpattern);
    }


});