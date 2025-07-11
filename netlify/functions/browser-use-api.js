// Browser Use API proxy function
exports.handler = async (event, context) => {
  try {
    console.log('Browser Use Function called');
    console.log('Method:', event.httpMethod);
    console.log('Path:', event.path);
  
  // Get API key from environment
  const API_KEY = process.env.BROWSER_USE_API_KEY;
  const API_URL = 'https://api.browser-use.com/api/v1';

  console.log('API_KEY exists:', !!API_KEY);

  if (!API_KEY) {
    console.error('BROWSER_USE_API_KEY not configured');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'API key not configured' }),
    };
  }

  try {
    console.log('Request body:', event.body);
    const { method, endpoint, body: requestBody } = JSON.parse(event.body || '{}');
    
    console.log('Parsed - Method:', method, 'Endpoint:', endpoint);
    
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
    console.log('Making request to:', url);
    console.log('With options:', JSON.stringify(options));
    
    const response = await fetch(url, options);
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log('Response text:', responseText);
    
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
  } catch (outerError) {
    console.error('Function failed:', outerError);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Function error', message: outerError.message }),
    };
  }
};