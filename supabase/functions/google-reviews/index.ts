import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Cache reviews in memory (edge function instance lifetime)
let cachedReviews: any = null;
let cacheTimestamp = 0;
const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('GOOGLE_PLACES_API_KEY');
    if (!apiKey) {
      throw new Error('GOOGLE_PLACES_API_KEY is not configured');
    }

    // Return cached if fresh
    const now = Date.now();
    if (cachedReviews && (now - cacheTimestamp) < CACHE_DURATION_MS) {
      return new Response(JSON.stringify(cachedReviews), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 1: Find the Place ID using Text Search
    const searchUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=Fluff+and+Scruff+Grooming+Studio+Hornchurch&inputtype=textquery&fields=place_id&key=${apiKey}`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();

    if (!searchData.candidates || searchData.candidates.length === 0) {
      throw new Error('Could not find the business on Google Maps');
    }

    const placeId = searchData.candidates[0].place_id;

    // Step 2: Get place details with reviews
    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,rating,user_ratings_total,reviews&reviews_sort=most_relevant&key=${apiKey}`;
    const detailsRes = await fetch(detailsUrl);
    const detailsData = await detailsRes.json();

    if (detailsData.status !== 'OK') {
      throw new Error(`Google Places API error: ${detailsData.status}`);
    }

    const result = detailsData.result;
    const response = {
      name: result.name,
      rating: result.rating,
      totalReviews: result.user_ratings_total,
      placeId,
      reviews: (result.reviews || []).map((r: any) => ({
        authorName: r.author_name,
        rating: r.rating,
        text: r.text,
        relativeTime: r.relative_time_description,
        profilePhoto: r.profile_photo_url,
      })),
    };

    cachedReviews = response;
    cacheTimestamp = now;

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching Google reviews:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
