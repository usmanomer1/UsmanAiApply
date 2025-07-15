// Jobotic API proxy function
exports.handler = async (event, context) => {
  // Only allow POST and GET requests
  if (event.httpMethod !== 'POST' && event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  const API_KEY = process.env.JOBOTIC_API_KEY;
  const API_URL = process.env.JOBOTIC_API_URL || 'https://jobotic-backend2-production.up.railway.app';

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
    
    console.log('Jobotic API Proxy:', {
      endpoint,
      method: event.httpMethod,
      hasAuthHeader: !!(event.headers.authorization || event.headers.Authorization),
      apiKeySet: !!API_KEY
    });

    // Extract authorization header if present (for endpoints requiring auth)
    const headers = {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
    };
    
    // Pass through Authorization header if present
    // Netlify normalizes headers to lowercase
    if (event.headers.authorization || event.headers.Authorization) {
      headers['Authorization'] = event.headers.authorization || event.headers.Authorization;
      console.log('Passing through auth header');
    }

    // Make the request to Jobotic API
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: event.httpMethod,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();

    return {
      statusCode: response.status,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    };
  } catch (error) {
    console.error('Jobotic API error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};