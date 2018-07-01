/*

Dean's 2D fluid sim.

http://neuroid.co.uk
dean@neuroid.co.uk

*/


function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
};

function calcMagnitude(x, y) {
    return Math.sqrt(x*x + y*y);
};

// Returns a function, that, as long as it continues to be invoked, will not
// be triggered. The function will be called after it stops being called for
// N milliseconds. If `immediate` is passed, trigger the function on the
// leading edge, instead of the trailing.
//
// via https://davidwalsh.name/javascript-debounce-function
function debounce(func, wait, immediate) {
	var timeout;
	return function() {
		var context = this, args = arguments;
		var later = function() {
			timeout = null;
			if (!immediate) func.apply(context, args);
		};
		var callNow = immediate && !timeout;
		clearTimeout(timeout);
		timeout = setTimeout(later, wait);
		if (callNow) func.apply(context, args);
	};
};




fluid = {

	vectorField:undefined,

	particles:[],
	particleCount:2500,

	maxParticleSpeed: 8,

	colors:[],


	isMobile:false,
	objCanvas:undefined,
	ctx:undefined,

  showVectorField: true,
	enableFrameDragging:false,
	enableEmitter:false,

	loopTimer:undefined,
	loopTicker:0,

	emitterX:0,
	emitterY:0,

	vectorCombSize: 50,
	vectorCombMagnitude: 5,





	init:function(){
		//
		var ua = navigator.userAgent.toLowerCase();
		this.isMobile = ua.indexOf('android') !== -1 || ua.indexOf('webos') !== -1 || ua.indexOf('iphone') !== -1 || ua.indexOf('ipad') !== -1 || ua.indexOf('ipod') !== -1 || ua.indexOf('blackberry') !== -1 || ua.indexOf('windows phone') !== -1;

		// init vars
		this.initVectorField();
		this.initParticles();
		this.initColors();

		// init screen
		this.initDOM();

		//
		this.start();
	},

	initVectorField:function(){
		let persistedVectorFieldData = {};
		try {
			persistedVectorFieldData = this.fetchVectorFieldData();
		} catch(err) {
			// noop
		}

		//
		this.vectorField = new vectorField({
			width: 712,
			height: 681.5,
			areaWidth: 100,
			areaHeight: 100,
			...persistedVectorFieldData
		});

		this.persistVectorFieldData();
	},

	fetchVectorFieldData() {
		return JSON.parse(window.localStorage.getItem('persistedVectorFieldData'));
	},

	persistVectorFieldData(data = JSON.stringify(this.vectorField)) {
		console.log('Persisting vector data');
		window.localStorage.setItem('persistedVectorFieldData', data);
	},

	clearVectorFieldData() {
		console.log('Clearing persisted vector data');
		window.localStorage.removeItem('persistedVectorFieldData');

		this.initVectorField();
	},

	initParticles:function(){
		if( this.isMobile ) this.particleCount >>= 1;

		var p;
		var i = this.particleCount;
		while( i-- ){
			p = new particle(
				Math.random() * this.vectorField.width,
				Math.random() * this.vectorField.height
			);
			p.vx = (Math.random() - .5) * 2;
			p.vy = (Math.random() - .5) * 2;
			this.particles[i] = p;
		}

	},

	initColors:function(){
		var cols = this.colors;
		var i, mf;
		var red,green,blue;

		for( i=0; i<=255; i++ ){
			mf = i/255;

			red = Math.min( mf / .85, .85 ) * (1/.85) * 155 + 100>>0;
			green = mf * 155 + 100>>0;
			blue = 240;
			cols[i] = 'rgb(' + red + ',' + green + ',' + blue + ')';
		}
	},

	initDOM:function(){
		// init DOM elements

		// canvas
		this.objCanvas = document.createElement('canvas');
		this.objCanvas.style.width = (this.objCanvas.width = this.vectorField.width) + 'px';
		this.objCanvas.style.height = (this.objCanvas.height = this.vectorField.height) + 'px';
		this.ctx = this.objCanvas.getContext('2d');

		var obj = document.getElementById('fluid_container') || document.body;
		obj.appendChild( this.objCanvas );

		document.addEventListener( 'mousemove', function( _event ){
			var e = _event || event;
			var x = e.clientX;
			var y = e.clientY;
			fluid.mouseMove( x,y );
		});
		this.objCanvas.addEventListener( 'mousedown', function( _event ){
			fluid.mouseDrag = true;
		});
		this.objCanvas.addEventListener( 'mouseup', function( _event ){
			fluid.mouseDrag = false;
		});

		this.initVectorComb();
	},

	initVectorComb() {
		this.prevCombX = 0;
		this.prevCombY = 0;

		const debouncedPersistVectorFieldData = debounce(this.persistVectorFieldData.bind(this), 1000);

		this.objCanvas.addEventListener('mousedown', (e) => {
			this.vectorCombDragging = true;

			var canvasBoundingRect = this.objCanvas.getBoundingClientRect();
			var combPosX = e.clientX - canvasBoundingRect.left;
			var combPosY = e.clientY - canvasBoundingRect.top;

			this.prevCombX = combPosX;
			this.prevCombY = combPosY;

			// Prevent double clicking from selecting part of DOM
			e.preventDefault();
		});
		document.addEventListener('mouseup', (e) => {
			this.vectorCombDragging = false;
		});
		this.objCanvas.addEventListener('mousemove', (e) => {
			var canvasBoundingRect = this.objCanvas.getBoundingClientRect();
			var combPosX = e.clientX - canvasBoundingRect.left;
			var combPosY = e.clientY - canvasBoundingRect.top;

			this.combX = combPosX;
			this.combY = combPosY;

			if (this.vectorCombDragging) {
				// Normalize the vector direction
				var vectorCombMagnitudeRaw = calcMagnitude(combPosX - this.prevCombX, combPosY - this.prevCombY);
				if (vectorCombMagnitudeRaw > 0) {
					var brushVectorX = (combPosX - this.prevCombX) / vectorCombMagnitudeRaw;
					var brushVectorY = (combPosY - this.prevCombY) / vectorCombMagnitudeRaw;

					var field = this.vectorField.field;
					var width = this.vectorField.width;
					var height = this.vectorField.height;
					var areaWidth = this.vectorField.areaWidth;
					var areaHeight = this.vectorField.areaHeight;

					for (var ix = 0; ix < areaWidth; ix++) {
						for (var iy = 0; iy < areaHeight; iy++) {
							var pointX = width * ((ix + 1) / areaWidth);
							var pointY = height * ((iy + 1) / areaHeight);

							var pointWithinBrushXRange = pointX > (combPosX - (this.vectorCombSize / 2)) && pointX < (combPosX + (this.vectorCombSize / 2));
							var pointWithinBrushYRange = pointY > (combPosY - (this.vectorCombSize / 2)) && pointY < (combPosY + (this.vectorCombSize / 2));
							if (pointWithinBrushXRange && pointWithinBrushYRange) {
								field[ix][iy].vx = this.vectorCombMagnitude * brushVectorX;
								field[ix][iy].vy = this.vectorCombMagnitude * brushVectorY;
							}
						}
					}
				}

				debouncedPersistVectorFieldData();

				this.prevCombX = combPosX;
				this.prevCombY = combPosY;
			}
		});

		var mousewheelCallback = (e) => {
			this.vectorCombSize = clamp(this.vectorCombSize + (0.20 * (e.deltaY || -e.detail)), 1, 999999);

			e.preventDefault();
		};
		this.objCanvas.addEventListener('mousewheel', mousewheelCallback);
		this.objCanvas.addEventListener('DOMMouseScroll', mousewheelCallback);

	},

	start:function(){
		window.requestAnimationFrame = window.requestAnimationFrame || window.mozRequestAnimationFrame || window.webkitRequestAnimationFrame || window.msRequestAnimationFrame;
		(window.animateFrame = function( time ){
			fluid.loop();

			window.animateTimestamp = time;
			window.requestAnimationFrame( animateFrame );
		})();
	},



	// ================================================== Events ==================================================

	mouseX:0,
	mouseY:0,
	mouseDrag:false,
	mouseMoved:false,

	mouseMove: function( _x,_y ){
		var x = _x - this.objCanvas.offsetLeft;
		var y = _y - this.objCanvas.offsetTop;

		var vx = x - this.mouseX;
		var vy = y - this.mouseY;
		this.mouseX = x;
		this.mouseY = y;

		this.mouseMoved = true;

		/* * /
		if( x >=0 && x <= this.vectorField.width && y >= 0 && y <= this.vectorField.height ){
			this.moveParticles( x, y, vx, vy );
		}
		/* */
	},

	clickCheckbox:function( obj ){
		fluid[ obj.name ] = obj.checked;
	},

	resetVelocity: function(){
		// reset the velocity of all particles and field areas

		// reset particles
		var p;
		var i = this.particleCount;
		while( i-- ){
			p = this.particles[i];
			p.vx = (Math.random() * 2 - 1 ) * p.vx * 0.9;
			p.vy = (Math.random() * 2 - 1 ) * p.vy * 0.9;
			p.speed = 0;
		}

		// reset areas
		var field = this.vectorField.field;
		var aw = this.vectorField.areaWidth;
		var ah = this.vectorField.areaHeight;
		var ax,ay;
		var area;

		ax = aw;
		while( ax-- ){
			ay = ah;
			while( ay-- ){

				area = field[ax][ay];
				area.vx = 0;
				area.vy = 0;
				area.vx_ = 0;
				area.vy_ = 0;

			}
		}
	},





	// ================================================== Loop ==================================================

	loop:function(){
		this.loopTicker++;

		/* * /
		if( this.mouseDrag ){
			this.addParticles( this.mouseX, this.mouseY );
		}else if( this.mouseMoved == false ){
			if( this.enableEmitter ){
				var x = (Math.sin( this.loopTicker * 0.016 ) * .45 + .5) * this.vectorField.width;
				var y = (Math.cos( this.loopTicker * 0.023 ) * .45 + .5) * this.vectorField.height;
				this.moveParticles( x,y, x - this.emitterX, y - this.emitterY );
				this.emitterX = x;
				this.emitterY = y;
				this.addParticles( x, y, 20 );
			}
		}
		/* */

		this.updateParticles();
		if( this.enableFrameDragging ) this.updateVectorField();

		this.clearScreen();
		this.drawParticles();

		if (this.showVectorField) {
			this.drawVectorField();
		}
		this.drawVectorComb();

		// reset flags
		this.mouseMoved = false;
	},



	updateParticles:function(){
		//
		var field = this.vectorField.field;

		var w = this.vectorField.width;
		var h = this.vectorField.height;

		var ax,ay;
		var aw = this.vectorField.areaWidth;
		var ah = this.vectorField.areaHeight;
		var axmf = this.vectorField.areaWidth / this.vectorField.width;
		var aymf = this.vectorField.areaHeight / this.vectorField.height;

		var maxspeed = this.maxParticleSpeed;
		var dis,mf;

		var p, i = this.particleCount;
		while( i-- ){
			p = this.particles[ i ];



			if( Math.random() < 0.01 ){
				// randomly reassign particle
				p = new particle(
					Math.random() * this.vectorField.width,
					Math.random() * this.vectorField.height
				);
				p.vx = Math.random() - .5;
				p.vy = Math.random() - .5;
				this.particles[ i ] = p;
				continue;
			}



			// limit velocity (angular)
			dis = Math.sqrt( p.vx * p.vx + p.vy * p.vy );
			if( dis > maxspeed ){
				mf = maxspeed / dis;
				p.vx *= mf;
				p.vy *= mf;
			}
			p.speed = dis;

			// random turbulence
			p.vx += (Math.random() -.5) * .1;
			p.vy += (Math.random() -.5) * .1;

			// friction
			p.vx *= 0.9;
			p.vy *= 0.9;

			p.ox = p.x;
			p.oy = p.y;
			p.x += p.vx;
			p.y += p.vy;

			if( p.x < 0 ) p.ox = p.x += w;
			if( p.x > w ) p.ox = p.x -= w;
			if( p.y < 0 ) p.oy = p.y += h;
			if( p.y > h ) p.oy = p.y -= h;


			ax = (((p.x + p.vx * 5) * axmf >> 0) + aw) % aw;
			ay = (((p.y + p.vy * 5) * aymf >> 0) + ah) % ah;

			// particles velocity influences area
			/* * /
			field[ax][ay].vx = clamp(field[ax][ay].vx + (p.vx *.05), -10, 10);
			field[ax][ay].vy = clamp(field[ax][ay].vy + (p.vy *.05), -10, 10);
			/* */

			// areas velocity influences particle
			p.vx += field[ax][ay].vx * .5;
			p.vy += field[ax][ay].vy * .5;
		}
	},

	updateVectorField:function(){
		//
		var field = this.vectorField.field;

		var aw = this.vectorField.areaWidth;
		var ah = this.vectorField.areaHeight;
		var ax,ay;

		var vx,vy,vx_,vy_;

		// get new vx,vy
		ax = aw;
		while( ax-- ){
			ay = ah;
			while( ay-- ){



				if( Math.random() < 0.01 ){
					// randomly reset field
					field[ax][ay].vx = field[ax][ay].vy = 0;
					field[ax][ay].vx_ = field[ax][ay].vy_ = 0;
					continue;
				}



				// blend this areas velocity with surrounding areas
				vx = 0 +
					(ax > 0 ? field[ax-1][ay].vx : 0) +
					(ax + 1 < aw ? field[ax+1][ay].vx : 0) +
					(ay > 0 ? field[ax][ay-1].vx : 0) +
					(ay + 1 < ah ? field[ax][ay+1].vx : 0);

				vy = 0 +
					(ax > 0 ? field[ax-1][ay].vy : 0) +
					(ax + 1 < aw ? field[ax+1][ay].vy : 0) +
					(ay > 0 ? field[ax][ay-1].vy : 0) +
					(ay + 1 < ah ? field[ax][ay+1].vy : 0);

				vx_ = vx *.1 + field[ax][ay].vx * Math.random(); // store new vx
				vy_ = vy *.1 + field[ax][ay].vy * Math.random(); // store new vy

				// limit area velocity (angular)
				dis = Math.sqrt( vx_ * vx_ + vy_ * vy_ );
				if( dis > 1 ){
					mf = 1 / dis;
					vx_ *= mf;
					vy_ *= mf;
				}

				//
				field[ax][ay].vx_ = vx_;
				field[ax][ay].vy_ = vy_;

			}
		}

		// copy across velocities
		var mf = 0.1;
		var imf = 1 - mf;
		var damp = 1;

		ax = aw;
		while( ax-- ){
			ay = ah;
			while( ay-- ){

				field[ax][ay].vx = (field[ax][ay].vx * imf + field[ax][ay].vx_ * mf) * damp;
				field[ax][ay].vy = (field[ax][ay].vy * imf + field[ax][ay].vy_ * mf) * damp;

			}
		}
	},



	clearScreen:function(){
		var ctx = this.ctx;

		//ctx.fillStyle = 'rgba(255,0,0,0.4)';
		//ctx.fillRect( 0,0, this.vectorField.width, this.vectorField.height );

		var image = new Image(1424, 1363);
		image.src = 'gitter-sign.jpg';
		ctx.drawImage(image, 0, 0, 712, 681.5);
	},

	drawParticles:function(){
		var ctx = this.ctx;
		var cols = this.colors;
		var mf;
		var imaxspeed = 1 / this.maxParticleSpeed;

		var p, i = this.particleCount;
		while( i-- ){
			p = this.particles[ i ];

			mf = p.speed * imaxspeed;
			if( mf > 1 ) mf = 1;

			ctx.strokeStyle = cols[ mf * mf * mf * mf * 255 >> 0 ];
			ctx.beginPath();
			ctx.moveTo( p.ox>>0, p.oy>>0 );
			ctx.lineTo( p.x>>0, p.y>>0 );
			ctx.stroke();
		}
	},

	drawVectorField: function() {
		var ctx = this.ctx;
		var colors = this.colors;

		var field = this.vectorField.field;
		var width = this.vectorField.width;
		var height = this.vectorField.height;
		var areaWidth = this.vectorField.areaWidth;
		var areaHeight = this.vectorField.areaHeight;

		for (var ix = 0; ix < areaWidth; ix++) {
			for (var iy = 0; iy < areaHeight; iy++) {
				var vector = field[ix][iy];

				ctx.strokeStyle = '#ff0000';
				ctx.beginPath();
				var pointX = width * ((ix + 1) / areaWidth);
				var pointY = height * ((iy + 1) / areaHeight);
				/* */
				ctx.moveTo(
					pointX,
					pointY
				);
				ctx.lineTo(pointX + vector.vx, pointY + vector.vy);
				/* */
				ctx.fillRect(pointX, pointY, 1, 1);
				ctx.stroke();
			}
		}
	},

	drawVectorComb: function() {
		var ctx = this.ctx;

		ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
		ctx.fillRect(
			this.combX - (this.vectorCombSize / 2),
			this.combY - (this.vectorCombSize / 2),
			this.vectorCombSize,
			this.vectorCombSize
		);

		ctx.strokeStyle = '#aa0000';
		ctx.strokeRect(
			this.combX - (this.vectorCombSize / 2),
			this.combY - (this.vectorCombSize / 2),
			this.vectorCombSize,
			this.vectorCombSize
		);
	},

	moveParticles:function( x,y, vx,vy ){

		var dis,mf;
		var influence = Math.sqrt( vx * vx + vy * vy ) * 4;
		if( influence > 100 ) influence = 100;

		var p, i = this.particleCount;
		while( i-- ){
			p = this.particles[ i ];

			// limit velocity (angular)
			dis = Math.sqrt( (x - p.x) * (x - p.x) + (y - p.y) * (y - p.y) );
			if( dis < influence ){
				mf = 1 - dis/influence;
				mf *= mf * mf * mf * mf;
				p.vx = p.vx * (1 - mf) + vx * mf;
				p.vy = p.vy * (1 - mf) + vy * mf;
			}

		}


		var field = this.vectorField.field;

		var aw = field.areaWidth;
		var ah = field.areaHeight;
		var axmf = this.vectorField.areaWidth / this.vectorField.width;
		var aymf = this.vectorField.areaHeight / this.vectorField.height;

		var amx = x * axmf >>0;
		var amy = y * aymf >>0;
		var arangex = influence * axmf + 1 << 1;
		var arangey = influence * aymf + 1 << 1;
		var ax,ay;
		var area;

		for( ax = amx - arangex; ax <= amx + arangex; ax++ ){
			if( ax >= 0 && field[ax] ){
				for( ay = amy - arangey; ay <= amy + arangey; ay++ ){
					if( ay >= 0 && field[ax][ay] ){

						area = field[ax][ay];
						area.vx = 0;
						area.vy = 0;
						area.vx_ = 0;
						area.vy_ = 0;

					}
				}
			}
		}
	},

	addParticles:function( x,y, count ){
		// adds some particles at the x,y coordinates

		var w = this.vectorField.width;
		var h = this.vectorField.height;
		if( x < 0 || x > w || y < 0 || y > h ) return;

		var i = count || 50;
		while( i-- ){
			p = this.particles[ Math.random() * this.particleCount >> 0 ];
			p.x = (x + Math.random() * 50 - 25 + w) % w;
			p.y = (y + Math.random() * 50 - 25 + h) % h;
			p.vx = Math.random() * 2 - 1;
			p.vy = Math.random() * 2 - 1;
			p.speed = 0;
		}
	}
}








vectorField = function(opts) {
	this.width = opts.width;
	this.height = opts.height;

	this.areaWidth = opts.areaWidth;
	this.areaHeight = opts.areaHeight;

	this.field = opts.field || ((() => {
		field = [];

		// init array
		var x,y;
		x = this.areaWidth;
		while( x-- ){
			field[x] = [];

			y = this.areaHeight;
			while( y-- ){
				field[x][y] = {
					vx: 0,
					vy: -5,
					vx_: 0,
					vy_: 0,
				};
			}
		}

		return field;
	})());
}

particle = function(x, y) {
	this.x = this.ox = x;
	this.y = this.oy = y;

	this.vx = 0;
	this.vy = 0;

	this.speed = 0; // speed
}
