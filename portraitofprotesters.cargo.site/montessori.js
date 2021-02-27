define([
	__cargo_context__ === "staging" ? '/_jsapps/imagegallery/base.js' : 'https://static.cargo.site/assets/builds/imagegallery/base.js'
],
function(
	GalleryBase
) {

	return GalleryBase.extend({

		name: 'Montessori',

		interactive: false,
		target_thumb: false,
		can_drag: false,
		thumb_changed: false,
		mouse_down: false,

		// allows images to be resized inside the Cargo editor
		allowsResize: true,

		// disallow default ghost image when dragged inside editor
		disableDragImage: true,

		/**
		 * Set attributes to el for layout options.
		 *
		 * @return {Object} attributes
		 */
		setElAttributes: function () {

			var model_data = Object.assign({}, this.galleryOptions.data);
			if ( this.mobile_active && model_data.responsive){
				model_data = _.extend(model_data, model_data.mobile_data);
			}


			this.el.classList.remove('slick');

	
			this.el.removeAttribute('image-gallery-horizontal-align');
			this.el.removeAttribute('image-gallery-vertical-align');
			this.el.removeAttribute('data-exploded');
			this.el.removeAttribute('data-slideshow-in-transition');
			this.el.removeAttribute('data-padding-zero');
			this.el.removeAttribute('image-gallery-pad');
			this.el.removeAttribute('image-gallery-gutter');

			if (model_data.zero_height){
				this.el.setAttribute('zero-height', '');
			} else {
				this.el.removeAttribute('zero-height');
			}

			this.el.setAttribute('image-gallery',this.name.toLowerCase());
			this.el.setAttribute('image-gallery-row','');

		},

		/**
		 * Bind event listeners.
		 *
		 * @return {Object} this
		 */
		initialize: function (options) {

			// center image on first render, if zero height

			if (!options){
				return
			}

			if( options.parentView) {
				this.parentView = options.parentView;
			}

			if ( options.galleryOptions){
				this.galleryOptions = Object.assign({}, options.galleryOptions);
			}

			return this;
		},


		destroy: function() {

			this.el.removeAttribute('image-gallery-horizontal-align');
			this.el.removeAttribute('image-gallery-vertical-align');
			this.el.removeAttribute('data-exploded');
			this.el.removeAttribute('data-slideshow-in-transition');
			this.el.removeAttribute('data-padding-zero');
			this.el.removeAttribute('image-gallery-pad');
			this.el.removeAttribute('image-gallery-gutter');
			this.el.removeAttribute('zero-height');

			if ( this.el.contains(this.dragged) ){
				$(this.dragged).remove();
				delete this.dragged;
			};

		},

		remove: function(){

			Backbone.View.prototype.remove.apply(this, arguments);
		},

		resizeImage: function(targetImage, scale){

			this.parentView.enableEditable();

			scale = Math.min(Math.max(1, scale), 130);

			var $target_thumb = $(targetImage).closest('[data-gallery-item-id]')
			var $meta_target = $(targetImage).closest('.gallery_card').find('[data-meta]');

			if ( $meta_target.length == 0 ) { return }

			var current_meta_data = Cargo.Core.ImageGallery.parseGalleryOptions( $meta_target.attr('data-meta') );

			if ( this.galleryOptions.data.snap_to_grid ){
				var snapX = Math.round(current_meta_data.montessori.x/(2.5))*2.5;
				var diffX = current_meta_data.montessori.x-snapX;

				scale = Math.max((2.5), Math.round((scale+diffX)/(2.5))*(2.5)) -diffX;
			}

			targetImage.setAttribute('data-scale', scale);


			current_meta_data.montessori.width = scale;
			current_meta_data.montessori.z = 9e9;

			// used to set 9999 but we no longer automatically insert at the end
			$meta_target.attr({
				'data-meta': JSON.stringify(current_meta_data),
				// 'data-gallery-item-index': 99999
			});

			$target_thumb.css({
				width: scale+'%'
			})

			var id = $target_thumb.attr("data-gallery-item-id");

			// set both places just in case
			this.galleryOptions.data.meta_data[id].width = scale;
			this.parentView.options.data.meta_data[id].width = scale;

			var max_y = 0;
			var lowest_y = 9e9;
			var highest_item_id = 0;
			var lowest_item_id = 0;

			_.each(this.images, _.bind(function(image, index){

				var meta = this.parentView.options.data.meta_data[index];

				var thumb_image_width = image.width || 1;
				var thumb_image_height = image.height || 1;

				var y_ratio = thumb_image_height/thumb_image_width
				var scaled_height = y_ratio * parseFloat(meta.width)

				var thumb_y = parseFloat(meta.y)
				var thumb_y_bottom = thumb_y+scaled_height;

				if ( thumb_y_bottom > max_y ){
					max_y = thumb_y_bottom;
					lowest_item_id = index;
				}

				if ( thumb_y < lowest_y ){
					lowest_y = thumb_y;
					highest_item_id = index;
				}

			}, this));


			this.parentView.options.data.lowest_y = this.galleryOptions.data.lowest_y = lowest_y;
			this.parentView.options.data.max_y = this.galleryOptions.data.max_y = max_y;
			this.parentView.options.data.height = this.galleryOptions.data.height = max_y-lowest_y;

			var lowestItem = this.el.querySelector('[data-lowest-item]');
			if ( lowestItem ){
				lowestItem.removeAttribute('data-lowest-item');
			}
			var newLowestItem = this.el.querySelector('[data-gallery-item-id="'+lowest_item_id+'"]');
			if ( newLowestItem ){
				newLowestItem.setAttribute('data-lowest-item', '');
			}

			if ( this.parentView.options && this.parentView.options.data ){
				this.parentView.updateOptions(this.parentView.options, true)
			}	

			this.setIndexHeight();

		},


		alignToGrid: function(grid_width_index, alignment_index){
			this.temporarily_center = true;
			var _this = this;

			var base_sizes = [50, 33.333, 25, 20, 48, 32, 24, 19.2, 46, 30.6666, 23, 18.4];
			var alignments = ['top', 'middle', 'bottom']

			var width = base_sizes[grid_width_index%base_sizes.length]
			var alignment = alignments[alignment_index%alignments.length];
			var lowest_y = 9e9;
			var thumbs_per_row = Math.floor(100/width);
			var thumbKeys = _.keys(this.parentView.images);
			var itemLength = thumbKeys.length;

			var tallestHeights = [];
			for(var i =0; i<itemLength; i=i+thumbs_per_row){
				var nextThumbsArray = [];

				for(var j = i; j< i+thumbs_per_row;j++){
					var key = thumbKeys[j];
					if ( key){
						nextThumbsArray.push(this.parentView.images[key]);
					}
				}

				var tallestYRatio = 0;
				var tallestThumb = null;
				_.each(nextThumbsArray, function(thumb){
					var height = parseInt(thumb.height);
					var width = parseInt(thumb.width);
					var yRatio = height/width || 0;

					if ( yRatio > tallestYRatio){
						tallestThumb = thumb;
						tallestYRatio =yRatio;
					}
				})

				tallestHeights.push(tallestYRatio);

			}

			var index = 0;
			var remainder = 100%(thumbs_per_row*width);
			var paddingSize = (remainder/(thumbs_per_row-1));

			for(var i in this.parentView.images){

				var thumb = this.parentView.images[i];
				var itemHeight = parseInt(thumb.height);
				var itemWidth = parseInt(thumb.width);
				var yRatio = itemHeight/itemWidth || 0;

				var rowIndex = Math.floor(index/thumbs_per_row);
				var tallHeight = tallestHeights[rowIndex]

				var marginTop = 0;
				if ( alignment === 'middle') {
					marginTop = (tallHeight-yRatio)*(width*.5);
				} else if ( alignment === 'bottom'){
					marginTop = (tallHeight-yRatio)*width;
				}

				var y_pos = _.reduce(tallestHeights, function(memo, num, heightIndex){
					if ( heightIndex < rowIndex ){
						return memo+num;
					} else {
						return memo;
					}
				}, 0);

				y_pos = y_pos * width + (paddingSize)*rowIndex + marginTop;

				var x_offset = ((index%(thumbs_per_row))/(thumbs_per_row-1))*remainder || 0;
				var x_pos = (index%thumbs_per_row)*width +x_offset;
				// var y_pos = Math.floor(index/thumbs_per_row)*width*2;

				index++;

				this.parentView.images[i].meta.montessori = {
					width: width,
					x: x_pos,
					y: y_pos,
					z: index
				};

			}

			this.handleUpdates(null, {changing: 'thumbnail_layout'});
			this.render();
		},


		random_index: 0,

		randomizeThumbSize: function(){
			this.temporarily_center = true;
			var _this = this;
			var base_sizes = [20, 30, 40, 50];
			this.random_index = this.random_index+1
			var random_size = base_sizes[this.random_index%base_sizes.length]
			var lowest_y = 9e9;
			var index = 0;
			for(var i in this.parentView.images){

				var width = random_size
				var thumbs_per_row = Math.floor(100/random_size)
				var remainder = 100%(thumbs_per_row*width)

				var x_offset = ((index%(thumbs_per_row))/(thumbs_per_row-1))*remainder || 0
				var x_pos = (index%thumbs_per_row)*random_size +x_offset
				var y_pos = Math.floor(index/thumbs_per_row)*width*2

				// width = Math.max(Math.min(width+Math.random()*width, 100), 5)
				var random_tester = Math.random()

				if ( random_tester > .9){
					width = Math.min(width +20, 100)
				} else if ( random_tester > .66){
					width = width +10
				} else if ( random_tester > .33 ){
					width = width - 5
				}

				random_tester = Math.random()

				if ( random_tester > .66 && x_pos < (100-width)-5 ){
					x_pos = x_pos +5
				} else if ( random_tester > .33 && x_pos > 5 ){
					x_pos = x_pos - 5
				}

				if ( x_pos > (100-width)){
					x_pos = Math.floor(Math.random()*(100-width)*.2)*5
				}

				y_pos = y_pos + Math.floor(Math.random()*random_size*2*.2)*5
				lowest_y = Math.min(y_pos, lowest_y);

				index++;

				this.parentView.images[i].meta.montessori = {
					width: width,
					x: x_pos,
					y: y_pos,
					z: index
				};

			}

			this.handleUpdates(null, {changing: 'thumbnail_layout'});
			this.render();
		},

		indicateInsertion: function(event, dragged, dragRect){

			if ( !dragRect ){
				return;
			}

			var thumbnailSizer = this.el.querySelector('.thumbnail_sizer');

			if ( !thumbnailSizer.contains(this.dragged) ){

				this.dragged = document.createElement('div');
				this.dragged.style.position = 'absolute'
				this.dragged.style.zIndex = 9999;
				this.dragged.style.transformOrigin = 'center center';
				this.dragged.style.outline = '1px solid rgba(128,128,128,0.5)';


				if (dragged && dragged.hasAttribute('data-rotation') ){
					this.dragged.style.transform = 'rotate('+dragged.getAttribute('data-rotation')+'deg)'
				}
				// this.dragged.style.outline = '10px solid red';

				this.dragged.style.outlineOffset = '-1px';

				thumbnailSizer.appendChild(this.dragged);
			}

			var m = {x: event.clientX, y: event.clientY};


			var insertion_point = this.images.length;
			var positioningRect = thumbnailSizer.getBoundingClientRect();

			var dragTargetOffset = 0;

			if ( this.dragTarget ){

				this.dragTarget.style.display = 'block'				
				var dragTargetRect = this.dragTarget.getBoundingClientRect();
				dragTargetOffset = -dragTargetRect.top;						
			}


			var pos_x = 100*(((m.x - positioningRect.left)+dragRect.offsets.x) / positioningRect.width);
			var pos_y = 100*(((m.y - positioningRect.top)+dragRect.offsets.y) / positioningRect.height);
			var width = 100*(dragRect.width / positioningRect.width);

			if ( this.galleryOptions.data.snap_to_grid){
				pos_x = Math.round(pos_x/2.5)*2.5;
				pos_y = Math.round(pos_y/2.5)*2.5;
				width = Math.round(width/2.5)*2.5;
			}

			this.parentView.insertionPoint = 9999;

			var meta_data = {
				montessori: {}
			};

			if (dragged && dragged.hasAttribute('data-meta')  ){

				meta_data = Cargo.Core.ImageGallery.parseGalleryOptions(dragged.getAttribute('data-meta'));

			}

			meta_data.montessori = {
				width: width,
				x: pos_x,
				y: pos_y,
				z: 999
			}

			var insertion_data = JSON.stringify(meta_data);

			if ( dragged ){
				dragged.setAttribute('data-meta', insertion_data );
			}

			this.parentView.meta_data_cache = insertion_data;

			this.dragged.style.top = pos_y+'%'
			this.dragged.style.left = pos_x+'%'
			this.dragged.style.width = width + '%';

			var yRatio = dragRect.height/dragRect.width;
			var widthDiff = width/((dragRect.width/positioningRect.width)*100)
			this.dragged.style.height = ((width*widthDiff)*yRatio) + '%';

		},

		resetIndication: function(){

			var _this = this;
			var thumbnailSizer = this.el.querySelector('.thumbnail_sizer');
			if ( thumbnailSizer.contains(this.dragged) ){
				$(this.dragged).remove();
				delete this.dragged;
			};
		
			if ( this.dragTarget ){
				this.dragTarget.style.display = '';
			}

			if ( Cargo.Core.ImageGallery.draggingInEditor ){
				this.parentView.draggingOverGallery = true;
			}

			this.setIndexHeight();

			this.parentView.meta_data_cache = ''
			this.parentView.insertionPoint = 0;

		},

		/**
		 * Handle the changes to the model triggered from the admin panel
		 * @param  {Object} galleryOptions new gallery options object from imagegallery.js
		 * @param  {Object} what value is changing inside view
		 */
		handleUpdates: function(galleryOptions, options){

			if ( galleryOptions ){
				this.galleryOptions = Object.assign({}, galleryOptions);
			}

			if ( !options){
				return
			}

			switch (options.changing) {

				case 'mobile_active':
					if ( model_data.responsive ){
						this.render();
					}
					break;

				case 'responsive':
					if ( this.galleryOptions.mobile_active){
						this.render();
					}
    				break;
    			case 'grid_align':
    				this.alignToGrid(options.data.grid_width_index, options.data.grid_align_index);
    				break;
				case 'captions':

					this.render();

					break;		
    			case 'randomize':
    				this.randomizeThumbSize();
    				break;

				case 'thumbnail_mode':
					break;

				case 'zero_height':
					this.temporarily_center = true;
					this.render();
					break;

				case 'thumbnail_layout':
				case 'gallery_changed':

					if ( this.parentView.isEditing){

						try {

							if ( window.top.hasOwnProperty('Cargo')){
								if ( window.top.Cargo.hasOwnProperty('Editor') ){
									window.top.Cargo.Editor.View.ContentView.SaveButton.trigger('save_enable');
								}
							}
						} catch(e){
							console.warn('Cargo Editor not found, Image Gallery settings will not be saved')
						}

					}

					break;

				default:
				    break;
			}

		},


		/**
		 * @return {Object} this
		 */
		render: function () {

			var _this = this;
			var model_data = Object.assign({}, this.galleryOptions.data);
			// set defaults for galleries that havent gotten updated settings
			if ( !model_data.hasOwnProperty('captions') ){
				model_data.captions = true;
			}			

			this.images = _.sortBy(this.parentView.images, 'index');

			// collect thumbnails into array sorted by z-index
			var images_id_z_pair = [];

			// only increment when data doesn't exist
			var change_index = 0;




			// fill meta_data object with defaults
			_.each(this.images, function(image, index){

				var meta_data = {};

				// set up default meta data
				if ( !_.property(index)(model_data.meta_data)  ){

					var x_pos = (change_index%3)*33.33
					var y_pos = Math.floor(index/4)*40
					var width = 30
					var z_index = index+1;

					meta_data = {
						width: width,
						x: x_pos,
						y: y_pos,
						z: z_index
					}

					change_index++;

				} else {
					meta_data = model_data.meta_data[index];
				}

				// prefer data in data-meta attributes over stored
				if ( image.meta.hasOwnProperty('montessori') ){
					model_data.meta_data[index] = _.defaults(image.meta.montessori, meta_data);
				} else {
					model_data.meta_data[index] = meta_data
				}

				model_data.meta_data[index].width = Math.max(1, model_data.meta_data[index].width)

				images_id_z_pair.push({
					id: index,
					z: model_data.meta_data[index].z
				});

			});

			// variables for finding the index height
			var max_y = 0;
			var lowest_y = 9e9;
			var highest_item_id = 0;
			var lowest_item_id = 0;

			_.each(this.images, function(image, index){

				var meta = model_data.meta_data[index];

				var thumb_image_width = image.width || 1;
				var thumb_image_height = image.height || 1;

				var y_ratio = thumb_image_height/thumb_image_width
				var scaled_height = y_ratio * parseFloat(meta.width)

				var thumb_y = parseFloat(model_data.meta_data[index].y)
				var thumb_y_bottom = thumb_y+scaled_height;

				if ( thumb_y_bottom > max_y ){
					max_y = thumb_y_bottom;
					lowest_item_id = index;
				}

				if ( thumb_y < lowest_y ){
					lowest_y = thumb_y;
					highest_item_id = index;
				}

			});


			images_id_z_pair = _.sortBy(images_id_z_pair, 'z');

			_.each(images_id_z_pair, function(image, index){
				model_data.meta_data[index].z = index+1;
			});

			if ( !Cargo.Core.ImageGallery.draggingInEditor ){

				if ( model_data.zero_height ){

					if ( this.temporarily_center ){

						var rect = this.el.getBoundingClientRect();
						var pageContent =  closest(this.el, function(parent){
							if(parent && parent.nodeType === Node.ELEMENT_NODE && parent.nodeName === "DIV") {
								return parent.classList.contains('page_content');
							}
						});

						var pageContentRect = pageContent.getBoundingClientRect();

						var pxHeight = rect.width*((max_y-lowest_y)*.01);

						var scrollY = window.scrollY;
						var docHeight = document.documentElement.scrollHeight+-pxHeight;

						var roomAbove = scrollY+rect.top;
						var roomBelow = (pageContentRect.top+pageContentRect.height+-rect.height)+-rect.top;
						// var extraRoomBelow = Math.max(0, window.innerHeight - (pageContentRect.top+Math.max(0,pageContentRect.height+-pxHeight)));
						var extraRoomBelow = docHeight-(pageContentRect.top+pageContentRect.height+scrollY+-pxHeight);

						var enoughRoomAboveAndBelow = roomAbove >= pxHeight * .4 && roomBelow >= pxHeight*.4;
						var enoughRoomBelow = roomBelow+extraRoomBelow >= pxHeight*.6;
						var noRoomAbove = roomAbove < pxHeight*.2;
						var enoughRoomAbove = roomAbove >= pxHeight*.6;

						
						var yAlign = "middle" // middle / bottom
						if ( enoughRoomAboveAndBelow ) {
							yAlign = "middle"
						} else if ( enoughRoomBelow || noRoomAbove) {
							yAlign = "top"
						} else if ( enoughRoomAbove ){
							yAlign = "bottom"
						}



						var yAdjust = 0;


						// if there's room, split it
						// favor roombelow since we're more likely to have extra room below
						if ( yAlign == "middle" ){
							yAdjust = -(max_y-lowest_y)*.5;
						} else if ( yAlign == "top" ) {
							yAdjust = 0;
						} else if ( yAlign == "bottom" ){
							yAdjust = -(max_y-lowest_y)
						} else {
							yAdjust = -(max_y-lowest_y)*.5
						}

						_.each(this.images, function(image, index){
							model_data.meta_data[index].y = model_data.meta_data[index].y - lowest_y;
							model_data.meta_data[index].y = model_data.meta_data[index].y + yAdjust;
						});

						this.temporarily_center = false;

					}

					model_data.height = max_y-lowest_y;

				} else if ( lowest_y != 0){

					_.each(this.images, function(image, index){
						model_data.meta_data[index].y = model_data.meta_data[index].y - lowest_y;
					});

					model_data.height = max_y-lowest_y;

				} else {
					model_data.height = max_y-lowest_y;
				}

				model_data.lowest_y = lowest_y;
				model_data.max_y = max_y;

			}


			for(var i in model_data.meta_data ){

				// clean up metadata
				if ( !this.images[i] ){
					delete model_data.meta_data[i]
				}

			}

			this.galleryOptions.data = Object.assign({}, model_data);

			// keep the gallery options local to the view
			if ( this.parentView.options && this.parentView.options.data ){
				// this used to call parentView.updateOptions on the galleryoptions but we want to retain the local 'responsive' value;
				this.parentView.options.data.meta_data = Object.assign({}, model_data.meta_data);
				this.parentView.options.data.lowest_y = model_data.lowest_y;
				this.parentView.options.data.max_y = model_data.max_y;
				this.parentView.options.data.height = model_data.height;
				this.parentView.updateOptions(this.parentView.options, true)
			}


			// render content into element div
			var fragment = document.createDocumentFragment();

			var thumbnailSizer = document.createElement('DIV');
			thumbnailSizer.className = 'thumbnail_sizer';
			fragment.appendChild(thumbnailSizer);

			_.each( this.images, function(imageObject, index) {

				var image = _this.createItem(imageObject);

				// this step realigns serialized order with render order
				image.setAttribute('data-gallery-item-index', index);
				image.setAttribute('data-gallery-item', '');

				var interiorImages = image.querySelectorAll('img[width][height], iframe[width][height], video[width][height]')
				var caption = document.createElement('DIV')
				var isLink = false

				caption.className = 'gallery_image_caption'
				if ( imageObject.caption ){
					if (  /<[a-z][\s\S]*>/i.test(imageObject.caption)  ){
						caption.innerHTML = imageObject.caption;
					} else {
						caption.innerText = imageObject.caption;
					}
				}

				_.each(interiorImages, function(interiorImage){

					if ( interiorImage.hasAttribute('data-elementresizer-child') ){
						return
					}

					interiorImage.setAttribute('data-elementresizer-no-resize' , '');
					interiorImage.setAttribute('data-elementresizer-no-centering' , '');
					interiorImage.setAttribute('data-elementresizer-no-vertical-resize', '');
					interiorImage.removeAttribute('data-icon-mode')	
					
					interiorImage.style.width = ''
					interiorImage.style.height = ''
				});

				if ( image.hasAttribute('width') && image.hasAttribute('height') && !image.hasAttribute('data-elementresizer-child') ){
					image.setAttribute('data-elementresizer-no-resize' , '');
					image.setAttribute('data-elementresizer-no-centering' , '');
					image.setAttribute('data-elementresizer-no-vertical-resize', '');
					image.removeAttribute('data-icon-mode')	
					
					image.style.width = ''
					image.style.height = ''
				}

				var ratio,
					thumb;

				if ( image.tagName === 'A' && interiorImages.length == 1 ){
					isLink = true
					thumb = image;
					ratio = interiorImages[0].getAttribute('height')/ interiorImages[0].getAttribute('width');
				} else {
					ratio = image.getAttribute('height')/image.getAttribute('width')
					thumb = document.createElement('DIV')
				}

				var setRotation = false;
				if ( !isNaN(imageObject.rotation) && imageObject.rotation !== 0 && imageObject.rotation!== 360 ){
					setRotation = true;
				}


				if ( imageObject.draggable || model_data.user_interactive){
					thumb.setAttribute('data-draggable', '')
				}

				thumb.setAttribute('class' , 'gallery_card');
				if ( imageObject.activeClass){
					image.classList.add('active')
				}				
				thumb.setAttribute('data-gallery-item-id' , index);

				thumb.style.width = model_data.meta_data[index].width + '%';
				thumb.style.top = model_data.meta_data[index].y + '%';
				thumb.style.left = model_data.meta_data[index].x + '%';
				thumb.style.zIndex = model_data.meta_data[index].z;

				if ( index == lowest_item_id){
					thumb.setAttribute('data-lowest-item', '');
				}

				thumb.style.transform = setRotation ? 'rotate('+imageObject.rotation+'deg)' : ''

				var thumb_inner = document.createElement('DIV')

				if ( isLink ){

					interiorImages[0].removeAttribute('data-scale');
					interiorImages[0].style.width = '';
					interiorImages[0].style.height = '';
					interiorImages[0].style.margin = '';
					interiorImages[0].setAttribute('data-meta', JSON.stringify({
						'montessori':model_data.meta_data[index]
					}) );
					thumb_inner.appendChild(interiorImages[0])

				} else {

					image.removeAttribute('data-scale');
					image.style.width = '';
					image.style.height = '';
					image.style.margin = '';
					thumb_inner.appendChild(image);
					image.setAttribute('data-meta', JSON.stringify({
						'montessori':model_data.meta_data[index]
					}) )
				}

				thumb_inner.setAttribute('class', 'gallery_card_image');
				thumb_inner.setAttribute('data-elementresizer-no-resize' , '');
				thumb_inner.setAttribute('data-elementresizer-no-centering' , '');
				thumb_inner.setAttribute('style', 'height: 0px; padding-bottom: ' + (ratio*100) + '%');


				thumb.appendChild(thumb_inner)

				if ( imageObject.caption ){
					if (  /<[a-z][\s\S]*>/i.test(imageObject.caption)  ){
						caption.innerHTML = imageObject.caption;
					} else {
						caption.innerText = imageObject.caption;
					}
				}

				if ( imageObject.caption && model_data.captions ){
					thumb.appendChild(caption);
					thumb.classList.add('has_caption');
				}

				thumbnailSizer.appendChild(thumb)
			});



			if ( Cargo.Helper.IsAdminEdit() ){

				this.el.innerHTML = '';
				this.el.appendChild(fragment);

			} else {

				var newEl = document.createElement('div');
				var elAttributes = this.el.attributes;

				_.each(elAttributes, function(attr){
					newEl.setAttribute(attr.name, attr.value);
				});

				newEl.appendChild(fragment)
				var oldEl = this.el;

				oldEl.parentNode.insertBefore(newEl, oldEl);
				oldEl.parentNode.removeChild(oldEl);
				this.parentView.setElement(newEl)
			}


			this.setElAttributes();
			this.setIndexHeight();

			// re-serialize because we probably shuffled around a lot of data
			if (Cargo.Helper.IsAdminEdit() ){
				this.parentView.images = this.serialize();

				if ( model_data.zero_height ){

					this.dragTarget = document.createElement('div');
					this.dragTarget.classList.add('drag-target');
					this.el.appendChild(this.dragTarget);
					if ( Cargo.Core.ImageGallery.draggingInEditor ){
						this.dragTarget.style.display = 'block'
					}

				} else {
					this.dragTarget = null;
				}

			}

			this.el.classList.add('initialized');
			Cargo.Plugins.elementResizer.requestRefreshTick();
			Cargo.Event.trigger('image_gallery_rendered', this);

			return this;
		},


		/**
		* calc and set index height
		**/
		setIndexHeight: function(){

			var _this = this
			var model_data = Object.assign({}, this.galleryOptions.data);
			var thumbnailSizer = this.el.querySelector('.thumbnail_sizer')
			this.el.classList.remove('shift-gallery-menu')

			if ( model_data.zero_height ) {

				this.el.style.paddingBottom = '0px';

			} else{

				if ( Cargo.Core.ImageGallery.draggingInEditor && _.keys(this.parentView.images).length> 0 ){

					thumbnailSizer.style.transform = 'translateY(100px)';
					this.el.classList.add('shift-gallery-menu')

					this.el.style.paddingBottom = 'calc('+model_data.height + '% + 200px)';
					this.el.style.marginTop = '-100px';
					this.el.style.marginBottom = '-100px';

				} else {

					var galleryMenu = this.el.querySelector('.image-gallery-menu');

					this.el.style.marginTop = ''
					this.el.style.marginBottom = ''

					thumbnailSizer.style.transform = '';
					var lowestItem = this.el.querySelector('[data-lowest-item]');
					var calcedHeight = model_data.max_y - model_data.lowest_y;

					if ( $(lowestItem).is('.has_caption') ){

						var caption = lowestItem.querySelector('.gallery_image_caption');

						if ( caption ){

							var captionStyle = window.getComputedStyle(caption);
							var position = captionStyle.getPropertyValue('position');

							if ( position === 'static' || position === 'relative'){

								var captionHeight = $(caption).outerHeight(true);

								this.el.style.paddingBottom  = 'calc('+calcedHeight + '% + '+captionHeight+'px)'
							} else {
								this.el.style.paddingBottom  = calcedHeight + '%';
							}
						}


					} else {
						this.el.style.paddingBottom  = calcedHeight + '%';
					}
				}

			}


		},


	})


});
