var gulp = require('gulp');
var sass = require('gulp-sass');
var inline = require('gulp-inline');
var uglify = require('gulp-uglify');
var minifyCss = require('gulp-minify-css');
var webserver = require('gulp-webserver');
var insert = require('gulp-insert');
var argv = require('yargs').argv;
var colors = require('colors');

gulp.task('sass', function () {
	gulp.src('./*.scss')
		.pipe(sass().on('error', sass.logError))
		.pipe(gulp.dest('./build'));
});

gulp.task('sass:watch', function () {
	gulp.watch('./*.scss', ['sass']);
});

gulp.task('html', function () {
	return gulp.src(['*.{html,php}', '!index.html'])
		.pipe(gulp.dest('build'));
});

gulp.task('site-html', function() {
	return gulp.src('index.html')
		.pipe(gulp.dest('site'));
})

gulp.task('html:watch', function () {
	gulp.watch('*.{html,php}', ['html', 'site-html']);
});

gulp.task('images', function () {
	return gulp.src('./images/**')
		.pipe(gulp.dest('./build/images'));
});

gulp.task('images:watch', function () {
	gulp.watch('./images/**', ['images']);
});

gulp.task('scripts', function() {
	return gulp.src('*.js')
		.pipe(gulp.dest('build'));
});

gulp.task('scripts:watch', ['widget'], function() {
	gulp.watch('*.js', ['widget']);
});

gulp.task('inline', function() {
	gulp.src('build/app.html')
		.pipe(inline({
		base: '',
		js: uglify(),
		css: minifyCss(),
		disabledTypes: ['svg', 'img'], // Only inline css files
		ignore: []
		}))
  	.pipe(gulp.dest('dist/'));
});

gulp.task('widget', ['scripts'], function() {
	if (argv.env == 'production' && argv.az) {
		gulp.src('build/widget.js')
			.pipe(insert.prepend('var HOST_URL = "https://az.widget.activeengage.ca", APP_URL = "";\n'))
			.pipe(gulp.dest('build'));
	}
	else if (argv.env == 'production') {
		gulp.src('build/widget.js')
			.pipe(insert.prepend('var HOST_URL = "https://contact.activeengage.ca", APP_URL = "/widget";\n'))
			.pipe(gulp.dest('build'));
	}
	else if (argv.env == 'dev') {
		gulp.src('build/widget.js')
			.pipe(insert.prepend('var HOST_URL = "http://contact.adamdipardo.com", APP_URL = "/dist";\n'))
			.pipe(gulp.dest('build'));
	}
	else {
		gulp.src('build/widget.js')
			.pipe(insert.prepend('var HOST_URL = "http://contact.site:8001", APP_URL = "";\n'))
			.pipe(gulp.dest('build'));
	}
});

gulp.task('widget-dist', function() {
	gulp.src('build/widget.js')
		.pipe(uglify())
		.pipe(gulp.dest('dist/'));
});

gulp.task('webserver', function() {
  gulp.src('build')
    .pipe(webserver({
      livereload: {
      	port: 35001
      },
      directoryListing: false,
      port: 8001,
      host: '0.0.0.0',
      proxies: [{source: '/api', target: 'http://127.0.0.1:8005'}]
    }));
});

gulp.task('siteserver', function() {
  gulp.src('site')
    .pipe(webserver({
      livereload: {
      	port: 35000
      },
      directoryListing: false,
      port: 8000,
      host: '0.0.0.0'
    }));
});

gulp.task('announce', function() {

	if (argv.env == 'production')
		console.log('\n!!!!!!!!!!!!!!!!!!!!!!!\n!!! PRODUCTION MODE !!!\n!!!!!!!!!!!!!!!!!!!!!!!\n'.inverse);
	else if (argv.env == 'dev')
		console.log('dev mode');
	else
		console.log('local mode');

});

gulp.task('default', ['webserver', 'siteserver', 'images', 'images:watch', 'html', 'site-html', 'html:watch', 'sass', 'sass:watch', 'scripts:watch'], function() {
	if (argv.env != 'dev' && argv.env != 'production') {
		console.log('\nReady! Now open http://127.0.0.1:8000 in your browser\n'.green);
	}
});
gulp.task('build-only', ['announce', 'images', 'html', 'sass', 'widget']);
gulp.task('create-dist', ['inline', 'widget-dist']);
