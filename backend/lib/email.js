// Brevo Email Service
const BREVO_API_KEY = process.env.BREVO_API_KEY
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email'

export async function sendEmail({ to, subject, htmlContent, textContent }) {
  console.log('📤 Attempting to send email to:', to)

  if (!BREVO_API_KEY) {
    console.log(`📧 [DEV MODE] Email to ${to}: ${subject}`)
    return { success: true, dev: true }
  }

  try {
    const response = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': BREVO_API_KEY,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        sender: {
          name: 'HURE Core',
          email: 'theboysofficialone@gmail.com'  // Must be verified in Brevo
        },
        to: [{ email: to }],
        subject,
        htmlContent,
        textContent
      })
    })

    const data = await response.json()

    console.log('📬 Brevo API response:', response.status, JSON.stringify(data))

    if (!response.ok) {
      console.error('❌ Brevo error:', data)
      return { success: false, error: data.message || 'Email send failed' }
    }

    console.log(`📧 Email sent to ${to}: ${subject}`)
    return { success: true, messageId: data.messageId }
  } catch (err) {
    console.error('Email error:', err)
    return { success: false, error: err.message }
  }
}

export async function sendOTPEmail(email, otp, orgName) {
  const subject = `Your HURE Core Verification Code: ${otp}`

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #0d9488; margin: 0;">HURE Core</h1>
        <p style="color: #64748b; margin: 5px 0 0;">Staff Management Platform</p>
      </div>
      
      <div style="background: #f8fafc; border-radius: 12px; padding: 30px; text-align: center;">
        <h2 style="color: #1e293b; margin: 0 0 10px;">Verify Your Email</h2>
        <p style="color: #64748b; margin: 0 0 25px;">
          ${orgName ? `Welcome ${orgName}! ` : ''}Use the code below to verify your email address.
        </p>
        
        <div style="background: #0d9488; color: white; font-size: 32px; font-weight: bold; letter-spacing: 8px; padding: 20px 40px; border-radius: 8px; display: inline-block;">
          ${otp}
        </div>
        
        <p style="color: #94a3b8; font-size: 14px; margin: 25px 0 0;">
          This code expires in 10 minutes. If you didn't request this, please ignore this email.
        </p>
      </div>
      
      <div style="text-align: center; margin-top: 30px; color: #94a3b8; font-size: 12px;">
        <p>© ${new Date().getFullYear()} HURE Core. All rights reserved.</p>
      </div>
    </div>
  `

  const textContent = `Your HURE Core verification code is: ${otp}\n\nThis code expires in 10 minutes.`

  return sendEmail({ to: email, subject, htmlContent, textContent })
}
