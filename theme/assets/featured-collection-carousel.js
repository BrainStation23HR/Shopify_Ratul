/**
 * Featured Collection Carousel Component
 * Handles carousel functionality and product card interactions
 */
// class FeaturedCollectionCarousel extends HTMLElement {
//     constructor() {
//         super();
//         this.carousel = this.querySelector('.product-carousel');

//         const swiper = new Swiper(this.carousel, {
//             // Optional parameters
//             direction: 'vertical',
//             loop: true,


//             // If we need pagination
//             pagination: {
//                 el: '.swiper-pagination',
//             },

//             // Navigation arrows
//             navigation: {
//                 nextEl: '.swiper-button-next',
//                 prevEl: '.swiper-button-prev',
//             },

//             // And if we need scrollbar
//             scrollbar: {
//                 el: '.swiper-scrollbar',
//             },
//         });
//     }


// }

// customElements.define('featured-collection-carousel', FeaturedCollectionCarousel);


class carouselComponent extends HTMLElement {
    constructor() {
      super();
    }

    connectedCallback() {
      this.initSlider();
    }

    initSlider() {
      this.carousel = this.querySelector('[id^="carousel-"]');
      if (!this.carousel) return;

      this.next = this.carousel.querySelector(".swiper-button-next");
      this.prev = this.carousel.querySelector(".swiper-button-prev");
      this.paginationEl = this.carousel.querySelector(".swiper-pagination");

      this.loop = this.carousel.getAttribute("data-loop") === "true";
      this.arrow = this.carousel.getAttribute("data-arrow") === "true";
      this.pagination = this.carousel.getAttribute("data-pagination") === "true";
      this.autoplay = this.carousel.getAttribute("data-autoplay") === "true";

      this.interval = parseInt(this.carousel.getAttribute("data-interval")) || 5000;
      this.transition = parseInt(this.carousel.getAttribute("data-transition")) || 300;

      this.desktop_item = parseInt(this.carousel.getAttribute("data-desktop-columns")) || 4;
      this.tab_item = parseInt(this.carousel.getAttribute("data-tabs-columns")) || 3;
      this.mobile_item = parseInt(this.carousel.getAttribute("data-mobile-columns")) || 1;

      this.desktop_spacing = parseInt(this.carousel.getAttribute("data-desktop-spacing-grid-horizontal")) || 20;
      this.spacing = parseInt(this.carousel.getAttribute("data-mobile-spacing-grid-horizontal")) || 10;

      const breakpoints = {
        640: { slidesPerView: this.desktop_item, spaceBetween: this.desktop_spacing },
        768: { slidesPerView: this.tab_item, spaceBetween: this.desktop_spacing },
        1024: { slidesPerView: this.desktop_item, spaceBetween: this.desktop_spacing }
      };

      this.swiperIns = new Swiper(this.carousel, {
        loop: this.loop,
        speed: this.transition,
        spaceBetween: this.spacing,
        slidesPerView: this.mobile_item,
        autoplay: this.autoplay
          ? {
              delay: this.interval,
              disableOnInteraction: false,
              pauseOnMouseEnter: true
            }
          : false,
        pagination: this.pagination
          ? {
              el: this.paginationEl,
              clickable: true,
                    type: "progressbar", 
            }
          : false,
        navigation: this.arrow
          ? {
              nextEl: this.next,
              prevEl: this.prev
            }
          : false,
        breakpoints
      });
    }

    slideAutoplayStop() {
      return this.swiperIns?.autoplay?.stop();
    }

    slideAutoplayStart() {
      return this.swiperIns?.autoplay?.start();
    }

    carouselSlideTo(index) {
      return this.loop ? this.swiperIns.slideToLoop(index) : this.swiperIns.slideTo(index);
    }

    destroySwiper() {
      if (this.swiperIns) {
        this.swiperIns.destroy(true, true);
        this.swiperIns = null;
      }
    }
  }

  if (!customElements.get("featured-collection-carousel")) {
    customElements.define("featured-collection-carousel", carouselComponent);
  }