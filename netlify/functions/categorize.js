exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  try {
    const { subject, body, tone } = JSON.parse(event.body);

    if (!body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Email body is required." }),
      };
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: "Groq API key is missing. Please set the GROQ_API_KEY environment variable in Netlify.",
        }),
      };
    }

    const systemPrompt = `You are an expert email automation assistant. 
Analyze the incoming email and return a JSON object with the following fields:
1. "category": A single-word category representing the sender's intent (e.g., Inquiry, Support, Complaint, Feedback, Sales, Spam).
2. "sentiment": A quick sentiment tag (e.g., Positive, Neutral, Negative, Urgent).
3. "summary": A brief 1-sentence summary summarizing what the sender wants.
4. "draftReply": A highly tailored, professional draft response to this email matching the requested tone: "${tone}".

Format your response as a valid, single JSON object only. Do not add markdown blocks like \`\`\`json.`;

    const userContent = `Subject: ${subject || "No Subject"}
Body:
${body}`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent }
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Groq API error: ${response.status} - ${errorText}`);
    }

    const completion = await response.json();
    const resultText = completion.choices[0].message.content;
    const resultJson = JSON.parse(resultText);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(resultJson),
    };

  } catch (error) {
    console.error("Error in handler:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal Server Error: " + error.message }),
    };
  }
};
