// deno-lint-ignore-file
// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "npm:stripe@13.12.0";

// Environment variable STRIPE_SECRET_KEY must be configured in Supabase project
serve(async (req) => {
  try {
    const { customer_id, return_url } = await req.json();

    if (!customer_id) {
      return new Response(JSON.stringify({ error: 'customer_id required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
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
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: err?.message || 'internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}); 