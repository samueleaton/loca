var gulp = require("gulp")
var uglify = require("gulp-uglify");
var rename = require("gulp-rename");
var plumber = require("gulp-plumber");

gulp.task("default", function(){
	gulp.src("loca.js")
	.pipe(plumber())
	.pipe(uglify())
	.pipe(rename("loca.min.js"))
	.pipe(gulp.dest("./"))
});