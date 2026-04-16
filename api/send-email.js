export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { to, code } = req.body;

        if (!to || !code) {
            return res.status(400).json({ error: 'Missing to or code' });
        }

        const API_KEY = process.env.RESEND_API_KEY || 're_D2qNJYg3_KP7gFg3Mgnb6H2MXueDhajLm';

        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`,
            },
            body: JSON.stringify({
                from: 'Acelerai <contato@grupoacelerai.com>',
                to: [to],
                subject: 'Seu código de verificação - Acelerai',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
                        <div style="text-align: center; margin-bottom: 20px;">
                            <h2 style="color: #2563eb; margin: 0;">Bem-vindo ao Acelerai!</h2>
                        </div>
                        <p style="color: #374151; font-size: 16px;">Olá,</p>
                        <p style="color: #374151; font-size: 16px;">Obrigado por se registrar. Por favor, use o código abaixo para verificar seu endereço de email:</p>
                        <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; text-align: center; margin: 24px 0;">
                            <span style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #111827;">${code}</span>
                        </div>
                        <p style="color: #6b7280; font-size: 14px; text-align: center;">Se você não solicitou este código, ignore este email.</p>
                    </div>
                `
            })
        });

        if (!response.ok) {
            const errorData = await response.text();
            console.error('Resend API Error:', errorData);
            return res.status(response.status).json({ error: 'Failed to send email' });
        }

        const data = await response.json();
        return res.status(200).json({ success: true, data });

    } catch (error) {
        console.error('Server error:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
