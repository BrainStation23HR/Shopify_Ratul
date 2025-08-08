# Dynamic Delivery - Shopify App

A Shopify app built with Remix for managing dynamic delivery scheduling and order management.

## Quick Setup

### Prerequisites
- Node.js 21+
- MySQL database
- Shopify CLI

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/BrainStation23HR/Shopify_Ratul.git
cd Shopify_Ratul/dynamic-delivery
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**
```bash
cp .env.example .env
```

Update your `.env` file:
```env
NAMESPACE=dynamic-delivery
SHOPIFY_API_KEY=your_api_key
SHOPIFY_API_SECRET=your_api_secret
SHOPIFY_APP_URL=https://your-ngrok-url.ngrok.io
SHOPIFY_DELIVERY_SELECTOR_ID=your_delivery_selector_id
HOST=https://your-ngrok-url.ngrok.io
DATABASE_URL="mysql://user:password@localhost:3306/delivery_scheduler"

# Email Service Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
```

4. **Update shopify.app.toml**
```toml
client_id = "your_api_key_from_partner_dashboard"
application_url = "https://yoururl.com"
redirect_urls = ["https://yoururl.com/auth/callback"]
```

5. **Setup MySQL database**
```sql
CREATE DATABASE delivery_scheduler;
```

6. **Start development server**
```bash
npm run dev
# or
npm run serve # this will use my static cloud flare tunnel https://tunnel.trustpulse.xyz
```

7. **Shopify Access**
- Need network access from partner dashboard to access the checkout APIs.

# Walk-through video

[![Watch the walkthrough](https://img.youtube.com/vi/zXElllX5IZk/hqdefault.jpg)](https://www.youtube.com/watch?v=zXElllX5IZk)

## Theme Development

For theme customization and development:

1. **Navigate to theme directory**
```bash
cd Shopify_Ratul/theme
```

2. **Start theme development server**
```bash
shopify theme dev
```

3. **Connect to your development store**
- Follow the CLI prompts to authenticate
- Select your development store
- The theme will be served with hot reload capabilities

4. **Theme features**

**Mega Menu**
- Hover and click interaction
- Responsive layout
- Example snippet will be provided
- Promotional Image
- Animation

**Product Page**
- Custom layout including:
- Product price
- Product title
- Product rating
- Product vendor
- Product description,
- Nutri score bar
- Variant picker / Color swatch
- Quantity Picker, add to cart button and buy now button
- Collapsible content (Nutritional information)
- Collapsible content (Goes well with)
- Pickup availability
- Social share icons
- Media picker / gallery with thumbnails carousels with zoom effect

**Featured Collection Section (Optional)**
- Promotional content area (heading + optional CTA) with left/right position setting
- Product cards displayed in a **carousel/slider**
- Ability to set the number of cards per slide (3 to 5)
- Inside each product card:
