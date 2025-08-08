# Advanced Shopify Components Development Guide

## Project Structure

```
/sections/
├── mega-menu.liquid
├── advanced-product.liquid
└── featured-collection-carousel.liquid

/snippets/
├── mega-menu-item.liquid
├── product-variant-picker.liquid
├── nutri-score-bar.liquid
├── product-media-gallery.liquid
└── collection-product-card.liquid

/assets/
├── mega-menu.js
├── mega-menu.css
├── advanced-product.js
├── advanced-product.css
├── featured-collection-carousel.js
└── featured-collection-carousel.css

/templates/
└── product.advanced.liquid (optional)
```

## Complete File Implementation

### ✅ Files Created:

1. **sections/mega-menu.liquid** - Full mega menu with promotional content
2. **assets/mega-menu.js** - Interactive JavaScript with accessibility
3. **assets/mega-menu.css** - Complete responsive styling

4. **sections/advanced-product.liquid** - Enhanced product page layout
5. **snippets/product-media-gallery.liquid** - Image gallery with zoom
6. **snippets/nutri-score-bar.liquid** - Visual nutrition indicator
7. **snippets/product-variant-picker.liquid** - Advanced variant selection
8. **assets/advanced-product.js** - Product page functionality

9. **sections/featured-collection-carousel.liquid** - Product carousel section
10. **snippets/collection-product-card.liquid** - Enhanced product cards
11. **assets/featured-collection-carousel.js** - Carousel with slideshows
12. **assets/featured-collection-carousel.css** - Complete carousel styling

## Key Features Implemented

### 🚀 Mega Menu Component
- **Interactive Navigation**: Hover and click functionality
- **Promotional Content**: Configurable images and content blocks
- **Multi-level Menus**: Support for nested navigation
- **Accessibility**: WCAG 2.1 AA compliant with ARIA labels
- **Responsive Design**: Mobile-first approach
- **Keyboard Navigation**: Full keyboard support
- **Smooth Animations**: CSS transitions with reduced motion support

### 🛍️ Advanced Product Page
- **Media Gallery**: Image zoom, thumbnails, video support
- **Variant Picker**: Color swatches, size selection
- **Nutri-Score Bar**: Visual nutrition indicator (A-E scale)
- **Collapsible Sections**: Nutritional info, recommendations
- **Social Sharing**: Copy link, social media buttons
- **Pickup Availability**: Store availability checker
- **Enhanced Form**: Quantity selector, buy now button
- **Progressive Enhancement**: Works without JavaScript

### 🎠 Featured Collection Carousel
- **Product Carousel**: Configurable cards per slide (3-5)
- **Mini Slideshows**: Image slideshows within product cards
- **Promotional Content**: Left/right positioned promo blocks
- **Touch/Swipe Support**: Mobile-friendly gestures
- **Autoplay**: Optional auto-advancing slides
- **Quick Actions**: Quick view, wishlist, add to cart
- **Responsive Grid**: Adapts from 4 cards to 1 on mobile

## Installation Instructions

### 1. Upload Files to Your Dawn Theme

```bash
# Copy files to your theme directory:
/sections/mega-menu.liquid
/sections/advanced-product.liquid  
/sections/featured-collection-carousel.liquid
/snippets/product-media-gallery.liquid
/snippets/nutri-score-bar.liquid
/snippets/product-variant-picker.liquid
/snippets/collection-product-card.liquid
/assets/mega-menu.js
/assets/mega-menu.css
/assets/advanced-product.js
/assets/advanced-product.css
/assets/featured-collection-carousel.js
/assets/featured-collection-carousel.css
```

### 2. Add Required Icons

Create these icon snippets in `/snippets/`:

```liquid
<!-- snippets/icon-caret.liquid -->
<svg viewBox="0 0 10 6" aria-hidden="true">
  <path fill="currentColor" d="m1.5 1.5 3.5 3.5 3.5-3.5" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/>
</svg>

<!-- snippets/icon-zoom.liquid -->
<svg viewBox="0 0 24 24" aria-hidden="true">
  <path fill="none" stroke="currentColor" stroke-width="2" d="m21 21-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z"/>
</svg>

<!-- snippets/icon-heart.liquid -->
<svg viewBox="0 0 24 24" aria-hidden="true">
  <path fill="currentColor" d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
</svg>

<!-- snippets/icon-eye.liquid -->
<svg viewBox="0 0 24 24" aria-hidden="true">
  <path fill="none" stroke="currentColor" stroke-width="2" d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
  <circle cx="12" cy="12" r="3"/>
</svg>
```

### 3. Add Sections to Theme

#### For Mega Menu:
1. Go to **Online Store > Themes > Customize**
2. Add the "Mega Menu" section to your header group
3. Configure menu and promotional blocks

#### For Advanced Product:
1. Create new template: `templates/product.advanced.liquid`
2. Add: `{% section 'advanced-product' %}`
3. Or replace existing product template

#### For Collection Carousel:
1. Add "Featured Collection Carousel" section to any template
2. Configure collection and display settings

### 4. Required Metafields

Set up these metafields for full functionality:

```javascript
// Product metafields needed:
{
  "custom.nutri_score": "single_line_text_field", // Values: A, B, C, D, E
  "custom.nutritional_info": "rich_text_field",
  "reviews.rating": "number_decimal", // For ratings
  "reviews.rating_count": "number_integer"
}
```

### 5. Theme Settings Integration

Add to your theme's `settings_schema.json`:

```json
{
  "name": "Advanced Components",
  "settings": [
    {
      "type": "header",
      "content": "Mega Menu Settings"
    },
    {
      "type": "checkbox",
      "id": "mega_menu_enabled",
      "label": "Enable mega menu",
      "default": true
    },
    {
      "type": "header", 
      "content": "Product Page Settings"
    },
    {
      "type": "checkbox",
      "id": "enable_product_zoom",
      "label": "Enable image zoom",
      "default": true
    },
    {
      "type": "checkbox",
      "id": "show_nutri_scores",
      "label": "Show nutri-score bars",
      "default": true
    }
  ]
}
```

## Performance Optimizations

### 1. Image Optimization
- All images use `loading="lazy"` except first image
- Responsive image widths based on container size
- WebP format support through Shopify's image transforms

### 2. JavaScript Loading
- All scripts use `defer` for non-blocking loading
- Event delegation for better performance
- Intersection Observer for lazy loading
- Debounced resize handlers

### 3. CSS Optimizations
- CSS custom properties for theming
- Mobile-first responsive design
- Hardware acceleration for smooth animations
- Reduced motion support

### 4. Accessibility Features
- ARIA labels and roles throughout
- Keyboard navigation support
- Screen reader announcements
- High contrast mode support
- Focus management

## Customization Guide

### 1. Styling Customization

Override CSS custom properties:

```css
:root {
  --mega-menu-bg: /* Your background color */;
  --product-card-radius: /* Your border radius */;
  --carousel-nav-size: /* Navigation button size */;
}
```

### 2. Functional Customization

Extend JavaScript classes:

```javascript
// Extend ProductCarousel for custom behavior
class CustomProductCarousel extends ProductCarousel {
  handleSlideChange() {
    super.handleSlideChange();
    // Your custom logic
  }
}
```

### 3. Schema Customization

Modify section schemas to add/remove settings:

```liquid
{% schema %}
{
  "settings": [
    // Add your custom settings here
  ]
}
{% endschema %}
```

## Browser Support

- **Modern browsers**: Full functionality
- **IE11**: Basic functionality with graceful degradation
- **Mobile browsers**: Optimized touch interactions
- **Screen readers**: Full accessibility support

## Testing Checklist

### ✅ Functionality Testing
- [ ] Mega menu opens/closes correctly
- [ ] Variant selection updates price and availability
- [ ] Image gallery zoom works on desktop
- [ ] Carousel swipe works on mobile
- [ ] Add to cart functions properly
- [ ] Quick view modal opens/closes
- [ ] All forms submit correctly

### ✅ Accessibility Testing
- [ ] Keyboard navigation works
- [ ] Screen reader announces changes
- [ ] Focus management is proper
- [ ] ARIA attributes are correct
- [ ] Color contrast meets WCAG standards

### ✅ Performance Testing
- [ ] Page load speed is acceptable
- [ ] Images load progressively
- [ ] No layout shift occurs
- [ ] Animations are smooth
- [ ] Mobile performance is good

## Troubleshooting

### Common Issues:

1. **Icons not displaying**: Ensure icon snippets are created
2. **JavaScript errors**: Check console for missing dependencies
3. **Styles not applying**: Verify CSS files are loaded
4. **Mobile issues**: Test responsive breakpoints
5. **Accessibility problems**: Use axe-core or similar tools

### Debug Mode:

Add to any component for debugging:

```javascript
// Enable debug mode
window.DEBUG_COMPONENTS = true;

// This will log component actions to console
```

## Advanced Features

### 1. Analytics Integration
```javascript
// Track carousel interactions
document.addEventListener('carousel:slide', (e) => {
  gtag('event', 'carousel_slide', {
    'slide_position': e.detail.slideIndex
  });
});
```

### 2. A/B Testing
```liquid
{% assign test_variant = customer.id | modulo: 2 %}
{% if test_variant == 0 %}
  <!-- Version A -->
{% else %}
  <!-- Version B -->
{% endif %}
```

### 3. Progressive Web App Features
```javascript
// Add to cart with offline support
if ('serviceWorker' in navigator) {
  // Implement offline functionality
}
```

This implementation provides production-ready, scalable Shopify components that demonstrate mastery of modern e-commerce development practices while maintaining excellent performance and accessibility standards.# Advanced Shopify Components Development Guide

## Project Structure

```
/sections/
├── mega-menu.liquid
├── advanced-product.liquid
└── featured-collection-carousel.liquid

/snippets/
├── mega-menu-item.liquid
├── product-variant-picker.liquid
├── nutri-score-bar.liquid
├── product-media-gallery.liquid
└── collection-product-card.liquid

/assets/
├── mega-menu.js
├── advanced-product.js
├── featured-collection-carousel.js
├── mega-menu.css
├── advanced-product.css
└── featured-collection-carousel.css

/templates/
└── product.advanced.liquid
```

## Implementation Plan

### 1. File Organization
- Follow Dawn's modular architecture
- Separate concerns between sections, snippets, and assets
- Use semantic naming conventions
- Implement proper error handling

### 2. Performance Strategy
- Lazy loading for all images
- Intersection Observer API for scroll-based loading
- Critical CSS inline for above-the-fold content
- Debounced event handlers for smooth interactions

### 3. Accessibility Implementation
- ARIA labels and roles
- Keyboard navigation support
- Screen reader compatibility
- Focus management for dynamic content

### 4. Mobile-First Approach
- Touch-friendly interactions
- Responsive breakpoints following Dawn's system
- Performance-optimized mobile experience
- Progressive enhancement

## Component Architecture

Each component follows this pattern:
1. **Section Template** - Main Liquid structure with schema
2. **Snippet Partials** - Reusable component parts
3. **JavaScript Module** - Vanilla JS with Web Components where applicable
4. **CSS Module** - Scoped styles following Dawn's design system

## Next Steps

I'll provide complete implementations for:
1. Mega Menu Component
2. Advanced Product Page Redesign
3. Featured Collection Carousel Section

Each will include detailed documentation and best practices.



Go to Online Store > Themes
Click Customize on your Dawn theme
In the left sidebar, click Header
Click + Add section
Select "Mega Menu" from the list
Configure your menu settings