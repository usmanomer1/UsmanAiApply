// Jobotic API proxy function
exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
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
    const { endpoint, ...body } = JSON.parse(event.body || '{}');
    
    if (!endpoint) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Endpoint is required' }),
      };
    }

    // Make the request to Jobotic API
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY,
      },
      body: JSON.stringify(body),
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