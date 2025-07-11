// Browser Use API proxy function
exports.handler = async (event, context) => {
  // Get API key from environment
  const API_KEY = process.env.BROWSER_USE_API_KEY;
  const API_URL = 'https://api.browser-use.com/v1';

  if (!API_KEY) {
    console.error('BROWSER_USE_API_KEY not configured');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'API key not configured' }),
    };
  }

  try {
    const { method, endpoint, body: requestBody } = JSON.parse(event.body || '{}');
    
    if (!endpoint) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Endpoint is required' }),
      };
    }

    // Build the full URL
    const url = `${API_URL}${endpoint}`;
    
    // Prepare request options
    const options = {
      method: method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
    };

    // Add body for POST/PUT requests
    if (requestBody && ['POST', 'PUT', 'PATCH'].includes(options.method)) {
      options.body = JSON.stringify(requestBody);
    }

    // Make the request to Browser Use API
    const response = await fetch(url, options);
    
    const responseText = await response.text();
    let data;
    
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      // If response is not JSON, return as-is
      data = responseText;
    }

    return {
      statusCode: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/json',
      },
      body: typeof data === 'string' ? data : JSON.stringify(data),
    };
  } catch (error) {
    console.error('Browser Use API error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error', details: error.message }),
    };
  }
};