# 🔐 OAuth 2.0 Setup Guide - Resolving Google Policy Compliance

**Problem**: "Access blocked: Authorization Error - Error 400: invalid_request"  
**Solution**: Proper OAuth consent screen configuration

## 🚨 Root Cause Analysis

Google blocks apps that don't properly configure their OAuth consent screen. The error occurs because:

1. **Missing OAuth Consent Screen Configuration**
2. **Incomplete App Information** 
3. **Unverified Developer Status**
4. **Missing Required Policy URLs**

## ✅ Complete Step-by-Step Fix

### Step 1: Configure OAuth Consent Screen

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com/
   - Select your project

2. **Navigate to OAuth Consent Screen**
   - Go to **APIs & Services > OAuth consent screen**
   - Choose **External** user type (unless you have Google Workspace)

3. **Fill Out App Information** (CRITICAL - All fields required)

   **OAuth consent screen tab:**
   ```
   App name: Seamless Encryptor
   User support email: your-email@gmail.com
   App logo: [Optional but recommended]
   
   App domain:
   Application home page: https://github.com/your-username/seamless-encryptor
   Application privacy policy: https://github.com/your-username/seamless-encryptor/blob/main/PRIVACY.md
   Application terms of service: https://github.com/your-username/seamless-encryptor/blob/main/TERMS.md
   
   Authorized domains:
   [Leave empty for localhost development]
   
   Developer contact information:
   Email addresses: your-email@gmail.com
   ```

4. **Configure Scopes** 
   - Click **Add or Remove Scopes**
   - Add these scopes:
     ```
     ../auth/drive.file
     ../auth/drive.readonly  
     ../auth/userinfo.email
     ```

5. **Add Test Users** (Required for External apps)
   - Click **Add Users**
   - Add your email: `your-email@gmail.com`
   - Add any other emails that need access during development

6. **Review and Submit**
   - Review all information
   - Click **Back to Dashboard**

### Step 2: Create Proper OAuth Credentials

1. **Go to Credentials**
   - **APIs & Services > Credentials**
   - Click **Create Credentials > OAuth client ID**

2. **Configure Desktop Application**
   ```
   Application type: Desktop application
   Name: Seamless Encryptor Desktop
   ```

3. **Download Credentials**
   - Click **Download JSON** (save as `credentials.json`)
   - Note the Client ID and Client Secret

### Step 3: Update Environment Configuration

Create/update your `.env` file:

```env
# Replace with your actual credentials from Step 2
GOOGLE_CLIENT_ID=123456789-abc123def456.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your_actual_client_secret_here
GOOGLE_REDIRECT_URI=urn:ietf:wg:oauth:2.0:oob

# App Information
APP_NAME=Seamless Encryptor
APP_VERSION=1.0.0
DEVELOPER_EMAIL=your-email@gmail.com
```

### Step 4: Required Policy Documents

Create these files in your project root:

**PRIVACY.md:**
```markdown
# Privacy Policy - Seamless Encryptor

## Data Collection
- We do not collect personal data
- Files are encrypted locally before cloud storage
- Google Drive access is limited to app-created files only

## Data Storage
- Encryption keys stored in system keychain
- No data transmitted to third parties
- Google Drive used only for encrypted file storage

## Contact
Email: your-email@gmail.com
```

**TERMS.md:**
```markdown
# Terms of Service - Seamless Encryptor

## Usage
- Free for personal and commercial use
- Open source software
- Use at your own risk

## Limitations
- No warranty provided
- Users responsible for key management
- Backup encryption keys regularly

## Contact
Email: your-email@gmail.com
```

### Step 5: Enhanced Error Handling

Update the application to handle OAuth compliance issues:

```javascript
// In main.js - Enhanced OAuth error handling
const validateOAuthSetup = () => {
  const issues = [];
  
  if (!isGoogleConfigured()) {
    issues.push('Google API credentials not configured');
  }
  
  if (!process.env.DEVELOPER_EMAIL) {
    issues.push('Developer email not set in .env file');
  }
  
  return issues;
};
```

### Step 6: Development vs Production

**For Development (Testing):**
1. Use **External** user type
2. Add yourself as test user
3. App will show "unverified" warning (normal during development)
4. Click "Advanced" → "Go to Seamless Encryptor (unsafe)" to proceed

**For Production (Public Release):**
1. Complete OAuth verification process
2. Submit app for Google review
3. Provide detailed app description and demo video
4. Wait for approval (can take weeks)

## 🔧 Troubleshooting Common Issues

### Error: "This app hasn't been verified by Google"
**Solution**: This is normal for external apps in development
- Click "Advanced" 
- Click "Go to Seamless Encryptor (unsafe)"
- Only affects unverified apps

### Error: "redirect_uri_mismatch"
**Solution**: Check redirect URI configuration
- Ensure using: `urn:ietf:wg:oauth:2.0:oob`
- Must match exactly in OAuth client settings

### Error: "invalid_scope"
**Solution**: Verify scopes in OAuth consent screen
- Must include: `drive.file`, `drive.readonly`, `userinfo.email`
- Scopes must be explicitly added in consent screen

### Error: "access_denied"
**Solution**: User not added to test users list
- Add user email in OAuth consent screen > Test users
- User must be explicitly allowed during development

## 🚀 Quick Setup Checklist

- [ ] OAuth consent screen completely filled out
- [ ] All required fields populated (app name, support email, etc.)
- [ ] Privacy policy and terms of service URLs added
- [ ] Test users added (your email)
- [ ] Scopes properly configured
- [ ] Desktop OAuth client created
- [ ] Credentials added to `.env` file
- [ ] Policy documents created (PRIVACY.md, TERMS.md)

## 📞 Still Having Issues?

1. **Check Google Cloud Console Logs**
   - APIs & Services > Credentials
   - Look for quota/error information

2. **Verify OAuth Consent Screen Status**
   - Should show "Testing" status
   - All required fields should be green checkmarks

3. **Test with Different Google Account**
   - Ensure test user is properly added
   - Try with a different browser/incognito mode

4. **Review Google's OAuth Policy**
   - https://support.google.com/cloud/answer/9110914
   - Ensure compliance with latest requirements

---

**✅ Once completed, restart your application and the OAuth error should be resolved!** 