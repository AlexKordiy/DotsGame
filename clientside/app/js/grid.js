pointsApp.directive("grid", function () {
    return {
        restrict: "A",
        link: function ($scope) {
            let max_size = $scope.canvas.width;
            $scope.points = [];
            $scope.points_position = [];

            for (let i = 0; i <= max_size; i = i + $scope.cell_size) {
                //X
                $scope.context.moveTo(0, i);
                $scope.context.lineTo(max_size, i);
                //Y
                $scope.context.moveTo(i, 0);
                $scope.context.lineTo(i, max_size);

                $scope.context.stroke();
            }
            for (let i = 0; i < $scope.points_count; i++) {
                $scope.points_position[i] = [];
                $scope.points[i] = $scope.cell_size * i;
                for (let j = 0; j < $scope.points_count; j++) {
                    $scope.points_position[i][j] = 0;
                }
            }
            console.log("Points positions: ", $scope.points_position);
        }
    }
});