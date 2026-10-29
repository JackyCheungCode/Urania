-- Urania connector catalog seed.
-- These rows are inventory only. No API is represented as authorized or configured.
insert into integrations.data_sources
  (provider_key, display_name, category, status, authorization_status, regions, capabilities, license_scope)
values
  ('serpapi', 'SerpApi', 'search', 'planned', 'unknown', array['global'], array['google_search','google_shopping','google_maps','search_results'], 'Provider account, product permissions, retention and commercial-use terms must be verified.'),
  ('dataforseo', 'DataForSEO', 'search', 'planned', 'unknown', array['global'], array['serp','keywords','shopping','trends'], 'Pricing, endpoint coverage, retention and commercial-use terms must be verified.'),
  ('google_trends', 'Google Trends', 'trends', 'planned', 'unknown', array['global'], array['search_interest','regional_interest','seasonality'], 'Official API availability and access eligibility must be confirmed; trend indices are not absolute search volume.'),
  ('keepa', 'Keepa', 'marketplace', 'planned', 'unknown', array['us','uk','de','fr','it','es','ca','jp'], array['amazon_catalog','price_history','sales_rank_proxy','offers'], 'API subscription, token budget, permitted storage and redistribution must be verified.'),
  ('amazon_sp_api', 'Amazon Selling Partner API', 'marketplace', 'planned', 'unknown', array['marketplace_dependent'], array['seller_authorized_catalog','own_seller_data','offers'], 'Access is role- and authorization-dependent; not a general all-market sales-data feed.'),
  ('ebay_browse', 'eBay Browse API', 'marketplace', 'planned', 'unknown', array['global'], array['active_listings','catalog','search'], 'Application approval, marketplace coverage and API terms must be verified; active listings are not completed sales.'),
  ('ebay_marketplace_insights', 'eBay Marketplace Insights', 'marketplace', 'planned', 'unknown', array['marketplace_dependent'], array['historical_market_insights'], 'Restricted availability and explicit approval must be confirmed before use.'),
  ('alibaba_open_platform', 'Alibaba Open Platform', 'supplier_data', 'planned', 'unknown', array['global'], array['supplier_catalog','product_discovery'], 'Developer registration, app review, API permissions and applicable terms must be verified.'),
  ('walmart_marketplace', 'Walmart Marketplace API', 'marketplace', 'planned', 'unknown', array['us','ca','mx'], array['seller_authorized_catalog','orders','offers'], 'Seller or partner authorization and permitted data scope must be verified.'),
  ('etsy_open_api', 'Etsy Open API', 'marketplace', 'planned', 'unknown', array['global'], array['listing_catalog','shop_data'], 'Application access, commercial-use terms and rate limits must be verified.'),
  ('mercado_libre', 'Mercado Libre Developers API', 'marketplace', 'planned', 'unknown', array['latam'], array['catalog','listings','seller_authorized_data'], 'Application permissions and market-specific terms must be verified.'),
  ('shopee_open_platform', 'Shopee Open Platform', 'marketplace', 'planned', 'unknown', array['southeast_asia'], array['seller_authorized_catalog','orders'], 'Partner onboarding, regional coverage and permissions must be verified.'),
  ('lazada_open_platform', 'Lazada Open Platform', 'marketplace', 'planned', 'unknown', array['southeast_asia'], array['seller_authorized_catalog','orders'], 'Partner onboarding, regional coverage and permissions must be verified.'),
  ('tiktok_shop', 'TikTok Shop API', 'marketplace', 'planned', 'unknown', array['marketplace_dependent'], array['seller_authorized_catalog','orders','shop_data'], 'Partner access, market eligibility and permissions must be verified.'),
  ('google_custom_search', 'Google Custom Search JSON API', 'search', 'planned', 'unknown', array['global'], array['web_search'], 'Current product availability, quota, pricing and terms must be verified before selection.'),
  ('apollo', 'Apollo API', 'company_data', 'planned', 'unknown', array['marketplace_dependent'], array['company_enrichment','contact_data'], 'Subscription, permitted use, data provenance and privacy obligations must be reviewed.'),
  ('hunter', 'Hunter API', 'contact_data', 'planned', 'unknown', array['global'], array['domain_search','email_verification'], 'Subscription, permitted use, data provenance and privacy obligations must be reviewed.'),
  ('openai_api', 'OpenAI API', 'ai', 'planned', 'unknown', array['service_dependent'], array['classification','matching','summarization','report_generation'], 'API account, data processing settings and applicable terms must be reviewed.'),
  ('supabase', 'Supabase', 'database', 'configured', 'approved', array['eu-west-1'], array['postgres','auth','migrations'], 'Existing Urania project; server-side credentials only.'),
  ('cloudflare_workers', 'Cloudflare Workers & Queues', 'other', 'configured', 'approved', array['eu'], array['api_runtime','queues','scheduled_jobs','observability'], 'Existing account resources must remain isolated from unrelated Workers and queues.')
on conflict (provider_key) do nothing;
