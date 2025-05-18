// backend/services/emailService.js
const nodemailer = require('nodemailer');

// Create a transporter object using Gmail SMTP transport
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT, 10),
    secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER, // Your Gmail address from .env
        pass: process.env.EMAIL_PASS, // Your Gmail App Password from .env
    },
    tls: {
        // do not fail on invalid certs (for local development if needed, but generally not for Gmail)
        // rejectUnauthorized: false 
    }
});

/**
 * Sends a survey resume link email.
 * @param {string} toEmail - The recipient's email address.
 * @param {string} surveyTitle - The title of the survey.
 * @param {string} resumeLink - The unique link to resume the survey.
 * @param {number} expiryDays - How many days until the link expires.
 * @returns {Promise<void>}
 */
const sendResumeEmail = async (toEmail, surveyTitle, resumeLink, expiryDays) => {
    const emailHtml = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <h2 style="color: #0056b3;">Continue Your Survey: "${surveyTitle}"</h2>
            <p>Hello,</p>
            <p>You recently saved your progress on the survey titled "<strong>${surveyTitle}</strong>".</p>
            <p>You can resume completing the survey by clicking the link below:</p>
            <p style="margin: 20px 0;">
                <a href="${resumeLink}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-size: 16px;">
                    Resume Survey
                </a>
            </p>
            <p>If the button above doesn't work, please copy and paste the following URL into your web browser:</p>
            <p><a href="${resumeLink}">${resumeLink}</a></p>
            <p style="font-size: 0.9em; color: #555;">
                This link will expire in ${expiryDays} day${expiryDays === 1 ? '' : 's'}. 
                If you did not request this, please ignore this email.
            </p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="font-size: 0.8em; color: #777;">
                Thank you,
                <br />
                The Survey Platform Team
            </p>
        </div>
    `;

    const mailOptions = {
        from: process.env.EMAIL_FROM_ADDRESS, // Sender address (e.g., '"Your App Name" <you@example.com>')
        to: toEmail,                            // List of receivers
        subject: `Resume Your Survey: ${surveyTitle}`, // Subject line
        html: emailHtml,                        // HTML body
    };

    try {
        console.log(`[EmailService] Attempting to send resume email to: ${toEmail}`);
        const info = await transporter.sendMail(mailOptions);
        console.log(`[EmailService] Message sent: ${info.messageId}`);
        // console.log(`[EmailService] Preview URL: ${nodemailer.getTestMessageUrl(info)}`); // Only for Ethereal
        return info;
    } catch (error) {
        console.error(`[EmailService] Error sending email to ${toEmail}:`, error);
        // Depending on your error handling strategy, you might want to throw the error
        // or handle it (e.g., log it but don't let it break the main flow if email is non-critical)
        throw new Error(`Failed to send resume email. Please try again later or contact support if the issue persists. Error: ${error.message}`);
    }
};

module.exports = {
    sendResumeEmail,
};