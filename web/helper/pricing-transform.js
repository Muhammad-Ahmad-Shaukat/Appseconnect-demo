import fetch from 'node-fetch';

export async function ensurePricingTransform(session) {
  const call = async (query, variables = {}) => {
    const response = await fetch(`https://${session.shop}/admin/api/2026-04/graphql.json`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'X-Shopify-Access-Token': session.accessToken},
      body: JSON.stringify({query, variables}),
    });
    const result = await response.json();
    if (!response.ok || result.errors?.length) throw new Error('Unable to check pricing function: ' + JSON.stringify(result.errors || response.status));
    return result.data;
  };
  const data = await call('query PricingTransforms { cartTransforms(first: 25) { nodes { id } } }');
  if (data?.cartTransforms?.nodes?.length) return;
  const created = await call(`mutation EnablePricing($handle: String!) {
    cartTransformCreate(functionHandle: $handle, blockOnFailure: true) {
      cartTransform { id }
      userErrors { field message }
    }
  }`, {handle: process.env.PRICING_FUNCTION_HANDLE || 'vip-price-transform'});
  const result = created?.cartTransformCreate;
  if (result?.userErrors?.length || !result?.cartTransform?.id) {
    throw new Error('Pricing function activation failed: ' + JSON.stringify(result?.userErrors || []));
  }
}
