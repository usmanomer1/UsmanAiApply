// Jobotic API proxy function
exports.handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Expose-Headers': 'Content-Type, X-Stream-Format',
      },
      body: '',
    };
  }

  // Only allow POST and GET requests
  if (event.httpMethod !== 'POST' && event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  const API_KEY = process.env.JOBOTIC_API_KEY;
  const API_URL = process.env.JOBOTIC_API_URL || process.env.VITE_JOBOTIC_API_URL || 'https://jobotic-backend2-production.up.railway.app';

  if (!API_KEY) {
    console.error('JOBOTIC_API_KEY not configured');
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
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
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Endpoint is required' }),
      };
    }
    
    // Keep minimal logging for production debugging
    console.log(`Jobotic API Proxy: ${event.httpMethod} ${endpoint}`);

    // Build headers - preserve important client headers
    const headers = {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
    };
    
    // Forward Accept header for streaming support
    const acceptHeader = event.headers.accept || event.headers.Accept;
    if (acceptHeader) {
      headers['Accept'] = acceptHeader;
      console.log(`Forwarding Accept header: ${acceptHeader}`);
    }
    
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
    const isStreamingRequest = acceptHeader === 'application/x-ndjson';
    
    console.log(`Making request to ${fullUrl} with Accept: ${acceptHeader || 'default'}`);

    // Make the request to Jobotic API
    const response = await fetch(fullUrl, {
      method: event.httpMethod,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    // Get response content type
    const responseContentType = response.headers.get('content-type') || 'application/json';
    const isStreamingResponse = responseContentType.includes('application/x-ndjson');
    
    console.log(`Response content-type: ${responseContentType}, streaming: ${isStreamingResponse}`);
    
    // Build response headers
    const responseHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
      'Access-Control-Expose-Headers': 'Content-Type, X-Stream-Format',
      'Content-Type': responseContentType,
    };
    
    // Forward custom streaming header if present
    const streamFormat = response.headers.get('x-stream-format');
    if (streamFormat) {
      responseHeaders['X-Stream-Format'] = streamFormat;
    }
    
    // Forward cache control headers if present
    const cacheControl = response.headers.get('cache-control');
    if (cacheControl) {
      responseHeaders['Cache-Control'] = cacheControl;
    }
    
    if (!response.ok) {
      console.error(`API Error Response: ${response.status}`);
    }

    // Handle streaming NDJSON response
    if (isStreamingResponse) {
      // For Netlify Functions, we can't truly stream, but we can return the raw NDJSON
      const text = await response.text();
      
      return {
        statusCode: response.status,
        headers: responseHeaders,
        body: text, // Return raw NDJSON text
        isBase64Encoded: false,
      };
    } else {
      // Handle regular JSON response
      let data;
      const responseText = await response.text();
      
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error('Failed to parse JSON response:', e);
        // Return raw text if JSON parsing fails
        return {
          statusCode: response.status,
          headers: responseHeaders,
          body: responseText,
          isBase64Encoded: false,
        };
      }
      
      return {
        statusCode: response.status,
        headers: responseHeaders,
        body: JSON.stringify(data),
        isBase64Encoded: false,
      };
    }
  } catch (error) {
    console.error('Jobotic API proxy error:', error.message || error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message 
      }),
    };
  }
};