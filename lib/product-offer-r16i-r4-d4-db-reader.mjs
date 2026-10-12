/**
 * Read-only production reader for exact R16I case. No external product selector
 * and no mutations. All requested relations must succeed before rendering.
 */
import { buildR16IR4D4LiveReview, R16I_PRODUCT_ID, R16I_RETAIL_URL } from "./product-offer-r16i-r4-d4-live-review.mjs";

function unwrapRows(result,name){
  if(result?.error || !Array.isArray(result?.data)){
    throw new Error("R16I_D4_READ_FAILED:"+name);
  }
  return result.data;
}
export async function readR16IR4D4Review(client) {
  if (!client || typeof client.from!=="function") throw new Error("R16I_D4_DB_UNAVAILABLE");
  const productSelect="id,name,brand,category,size_ml,price_min,price_max,unit_price_per_10ml,buy_link,hwahae_url,source_url,external_source,external_type,external_id,market_signals,updated_at";
  const bindingSelect="binding_id,product_id,source_name,external_type,external_id,source_url,binding_state,product_scope_state,updated_at";
  const intakeSelect="id,product_id,subject_id,identity_state,trust_state,updated_at";
  const checks=await Promise.all([
    client.from("products").select(productSelect).eq("id",R16I_PRODUCT_ID).limit(2),
    client.from("product_source_bindings").select(bindingSelect).eq("product_id",R16I_PRODUCT_ID).limit(2),
    client.from("product_source_bindings").select(bindingSelect).eq("source_name","hwahae").eq("external_type","goods").eq("external_id","45194").limit(2),
    client.from("product_offers").select("offer_id,product_id,seller_key,listing_id,listing_url").eq("product_id",R16I_PRODUCT_ID).limit(2),
    client.from("product_offers").select("offer_id,product_id,seller_key,listing_id,listing_url").eq("seller_key","hwahae").eq("listing_id","45194").limit(2),
    client.from("product_offers").select("offer_id,product_id,seller_key,listing_id,listing_url").eq("seller_key","hwahae").eq("listing_url",R16I_RETAIL_URL).limit(2),
    client.from("product_fact_subjects").select("subject_id,product_id").eq("product_id",R16I_PRODUCT_ID).limit(2),
    client.from("catalog_trust_intake").select(intakeSelect).eq("product_id",R16I_PRODUCT_ID).limit(2)
  ]);
  const [products,bindings,sourceMatches,offersByProduct,offersByListing,offersByURL,subjects,intakes]=
    checks.map((x,i)=>unwrapRows(x,["product","bindings","source_matches","offers_product","offers_listing","offers_url","subjects","intakes"][i]));
  const observed_at=new Date().toISOString();
  if(products.length!==1)
    return buildR16IR4D4LiveReview({observed_at,product:null,
      bindings,offers_by_product:offersByProduct,offers_by_listing:offersByListing,
      offers_by_url:offersByURL,subjects,intakes});
  // Do not allow another product's source identity to be silently excluded.
  const allBindings=new Map([...bindings,...sourceMatches].map(x=>[x.binding_id,x]));
  return buildR16IR4D4LiveReview({
    observed_at,product:products[0],bindings:[...allBindings.values()],
    offers_by_product:offersByProduct,offers_by_listing:offersByListing,
    offers_by_url:offersByURL,subjects,intakes
  });
}
