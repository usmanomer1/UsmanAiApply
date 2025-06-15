const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { default: Stripe } = await import("npm:stripe@17.7.0");
    
    const { customer_id, return_url } = await req.json();

    if (!customer_id) {
      return new Response(JSON.stringify({ error: 'customer_id required' }), {
        status: 400,
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
      apiVersion: '2023-10-16'
    });

    const session = await stripe.billingPortal.sessions.create({
      customer: customer_id,
      return_url: return_url || req.headers.get('origin') || 'https://aiapply.app/billing'
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: err?.message || 'internal error' }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
});