// Jobotic API proxy function
exports.handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      },
      body: '',
    };
  }

  // Only allow POST and GET requests
  if (event.httpMethod !== 'POST' && event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  const API_KEY = process.env.JOBOTIC_API_KEY;
  const API_URL = process.env.JOBOTIC_API_URL || process.env.VITE_JOBOTIC_API_URL || 'https://jobotic-backend2-production.up.railway.app';

  if (!API_KEY) {
    console.error('JOBOTIC_API_KEY not configured');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'API key not configured' }),
    };
  }

  try {
    let endpoint, body;
    
    if (event.httpMethod === 'GET') {
      // For GET requests, extract endpoint from query parameters
      endpoint = event.queryStringParameters?.endpoint;
      body = null;
    } else {
      // For POST requests, parse the body
      const parsed = JSON.parse(event.body || '{}');
      endpoint = parsed.endpoint;
      body = parsed;
      delete body.endpoint; // Remove endpoint from body
    }
    
    if (!endpoint) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Endpoint is required' }),
      };
    }
    
    // Keep minimal logging for production debugging
    console.log(`Jobotic API Proxy: ${event.httpMethod} ${endpoint}`);

    // Extract authorization header if present (for endpoints requiring auth)
    const headers = {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
    };
    
    // Pass through Authorization header if present
    // Netlify normalizes headers to lowercase
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (authHeader) {
      // Ensure it starts with "Bearer " (with capital B)
      if (authHeader.toLowerCase().startsWith('bearer ')) {
        headers['Authorization'] = authHeader;
      } else {
        headers['Authorization'] = `Bearer ${authHeader}`;
      }
    }
    
    const fullUrl = `${API_URL}${endpoint}`;

    // Make the request to Jobotic API
    const response = await fetch(fullUrl, {
      method: event.httpMethod,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error(`API Error Response: ${response.status}`);
    }

    return {
      statusCode: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
      body: JSON.stringify(data),
    };
  } catch (error) {
    console.error('Jobotic API proxy error:', error.message || error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};