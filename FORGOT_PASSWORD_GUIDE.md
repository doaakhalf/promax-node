# Forgot Password Implementation Guide

## 📋 Overview

This guide explains how to implement the **Forgot Password** and **Reset Password** functionality in your frontend application. The backend uses secure token-based password reset with email verification.

---

## 🔐 How It Works

### **Flow:**

1. **User requests password reset** → Enters email address
2. **Backend generates secure token** → Stores hashed token + expiry in database
3. **Email sent with reset link** → Link contains unhashed token
4. **User clicks email link** → Redirected to reset password page
5. **User enters new password** → Backend verifies token and updates password
6. **Token invalidated** → Can only be used once, expires in 1 hour

---

## 🚀 API Endpoints

### **Base URL:** `https://your-api.com/api/password`

### **1. Request Password Reset**

```
POST /api/password/forgot
```

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response (Success):**
```json
{
  "status": "success",
  "message": "Password reset link has been sent to your email."
}
```

**Response (Error):**
```json
{
  "status": "error",
  "message": "Email is required"
}
```

**Notes:**
- Always returns success even if email doesn't exist (security feature)
- Email will only be sent if account exists
- Token expires in 1 hour

---

### **2. Reset Password**

```
POST /api/password/reset
```

**Request Body:**
```json
{
  "token": "abc123...",
  "newPassword": "newSecurePassword123"
}
```

**Response (Success):**
```json
{
  "status": "success",
  "message": "Password has been reset successfully. You can now login with your new password."
}
```

**Response (Error - Invalid Token):**
```json
{
  "status": "error",
  "message": "Invalid or expired reset token"
}
```

**Response (Error - Weak Password):**
```json
{
  "status": "error",
  "message": "Password must be at least 8 characters long"
}
```

**Validation:**
- Token is required
- New password is required
- Password must be at least 8 characters

---

### **3. Verify Reset Token (Optional)**

```
GET /api/password/verify/:token
```

**Response (Valid Token):**
```json
{
  "status": "success",
  "message": "Token is valid",
  "data": {
    "email": "user@example.com"
  }
}
```

**Response (Invalid Token):**
```json
{
  "status": "error",
  "message": "Invalid or expired token"
}
```

**Use Case:**
- Check if token is valid before showing reset password form
- Display user's email on reset page

---

## 📱 Frontend Implementation

### **React Native Example**

#### **1. Forgot Password Screen**

```javascript
import React, { useState } from 'react';
import { View, Text, TextInput, Button, Alert } from 'react-native';

const ForgotPasswordScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleForgotPassword = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('https://promax-node-production-7c35.up.railway.app/api/password/forgot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email.toLowerCase() })
      });

      const data = await response.json();

      if (data.status === 'success') {
        Alert.alert(
          'Success', 
          'Check your email for password reset instructions',
          [
            {
              text: 'OK',
              onPress: () => navigation.navigate('Login')
            }
          ]
        );
      } else {
        Alert.alert('Error', data.message);
      }
    } catch (error) {
      Alert.alert('Error', 'Network error. Please try again.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ padding: 20 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 20 }}>
        Forgot Password
      </Text>
      
      <Text style={{ marginBottom: 10 }}>
        Enter your email address and we'll send you a link to reset your password.
      </Text>

      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        style={{
          borderWidth: 1,
          borderColor: '#ddd',
          padding: 12,
          borderRadius: 8,
          marginBottom: 20
        }}
      />

      <Button
        title={loading ? "Sending..." : "Send Reset Link"}
        onPress={handleForgotPassword}
        disabled={loading}
      />

      <Button
        title="Back to Login"
        onPress={() => navigation.navigate('Login')}
        color="#666"
      />
    </View>
  );
};

export default ForgotPasswordScreen;
```

---

#### **2. Reset Password Screen**

```javascript
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, Alert } from 'react-native';

const ResetPasswordScreen = ({ route, navigation }) => {
  const [token, setToken] = useState('');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);

  useEffect(() => {
    // Get token from deep link or navigation params
    const resetToken = route.params?.token;
    
    if (resetToken) {
      setToken(resetToken);
      verifyToken(resetToken);
    } else {
      Alert.alert('Error', 'Invalid reset link');
      navigation.navigate('Login');
    }
  }, []);

  const verifyToken = async (resetToken) => {
    try {
      const response = await fetch(
        `https://promax-node-production-7c35.up.railway.app/api/password/verify/${resetToken}`
      );

      const data = await response.json();

      if (data.status === 'success') {
        setEmail(data.data.email);
      } else {
        Alert.alert('Error', 'This reset link is invalid or has expired', [
          {
            text: 'OK',
            onPress: () => navigation.navigate('Login')
          }
        ]);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to verify reset link');
    } finally {
      setVerifying(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (newPassword.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('https://promax-node-production-7c35.up.railway.app/api/password/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: token,
          newPassword: newPassword
        })
      });

      const data = await response.json();

      if (data.status === 'success') {
        Alert.alert(
          'Success',
          'Your password has been reset successfully!',
          [
            {
              text: 'Login Now',
              onPress: () => navigation.navigate('Login')
            }
          ]
        );
      } else {
        Alert.alert('Error', data.message);
      }
    } catch (error) {
      Alert.alert('Error', 'Network error. Please try again.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (verifying) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Verifying reset link...</Text>
      </View>
    );
  }

  return (
    <View style={{ padding: 20 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 20 }}>
        Reset Password
      </Text>

      <Text style={{ marginBottom: 20, color: '#666' }}>
        Resetting password for: {email}
      </Text>

      <TextInput
        placeholder="New Password"
        value={newPassword}
        onChangeText={setNewPassword}
        secureTextEntry
        style={{
          borderWidth: 1,
          borderColor: '#ddd',
          padding: 12,
          borderRadius: 8,
          marginBottom: 15
        }}
      />

      <TextInput
        placeholder="Confirm New Password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
        style={{
          borderWidth: 1,
          borderColor: '#ddd',
          padding: 12,
          borderRadius: 8,
          marginBottom: 20
        }}
      />

      <Text style={{ color: '#666', fontSize: 12, marginBottom: 20 }}>
        Password must be at least 8 characters long
      </Text>

      <Button
        title={loading ? "Resetting..." : "Reset Password"}
        onPress={handleResetPassword}
        disabled={loading}
      />
    </View>
  );
};

export default ResetPasswordScreen;
```

---

### **Web (React) Example**

#### **Forgot Password Component**

```javascript
import React, { useState } from 'react';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const response = await fetch('https://promax-node-production-7c35.up.railway.app/api/password/forgot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await response.json();
      
      if (data.status === 'success') {
        setMessage('Check your email for reset instructions');
        setEmail('');
      } else {
        setMessage(data.message);
      }
    } catch (error) {
      setMessage('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="forgot-password">
      <h2>Forgot Password</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Sending...' : 'Send Reset Link'}
        </button>
      </form>
      {message && <p>{message}</p>}
    </div>
  );
};

export default ForgotPassword;
```

#### **Reset Password Component**

```javascript
import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const tokenParam = searchParams.get('token');
    if (tokenParam) {
      setToken(tokenParam);
    } else {
      setMessage('Invalid reset link');
    }
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      setMessage('Passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setMessage('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const response = await fetch('https://promax-node-production-7c35.up.railway.app/api/password/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword })
      });

      const data = await response.json();
      
      if (data.status === 'success') {
        setMessage('Password reset successful! Redirecting to login...');
        setTimeout(() => navigate('/login'), 2000);
      } else {
        setMessage(data.message);
      }
    } catch (error) {
      setMessage('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="reset-password">
      <h2>Reset Password</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="password"
          placeholder="New Password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Confirm Password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Resetting...' : 'Reset Password'}
        </button>
      </form>
      {message && <p>{message}</p>}
    </div>
  );
};

export default ResetPassword;
```

---

## 🔗 Deep Linking Setup

### **React Native Deep Link Configuration**

To handle email links that open your app:

#### **1. Configure Deep Links in `app.json` (Expo)**

```json
{
  "expo": {
    "scheme": "promax",
    "ios": {
      "associatedDomains": ["applinks:your-domain.com"]
    },
    "android": {
      "intentFilters": [
        {
          "action": "VIEW",
          "data": [
            {
              "scheme": "https",
              "host": "your-domain.com",
              "pathPrefix": "/reset-password"
            }
          ],
          "category": ["BROWSABLE", "DEFAULT"]
        }
      ]
    }
  }
}
```

#### **2. Handle Deep Links in Navigation**

```javascript
import { Linking } from 'react-native';
import { useEffect } from 'react';

const App = () => {
  useEffect(() => {
    const handleDeepLink = ({ url }) => {
      const { path, queryParams } = Linking.parse(url);
      
      if (path === 'reset-password' && queryParams?.token) {
        navigation.navigate('ResetPassword', { token: queryParams.token });
      }
    };

    Linking.addEventListener('url', handleDeepLink);

    // Check if app was opened with a link
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink({ url });
      }
    });

    return () => {
      Linking.removeEventListener('url', handleDeepLink);
    };
  }, []);

  return <NavigationContainer>{/* Your navigation */}</NavigationContainer>;
};
```

---

## ⚙️ Backend Configuration

### **Environment Variables**

Add these to your `.env` file:

```env
# Email Configuration
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password

# Frontend URL (for reset link)
FRONTEND_URL=https://your-app.com
# or for React Native: FRONTEND_URL=trainify://
```

### **Gmail Setup:**

1. Enable 2-Factor Authentication on your Google account
2. Go to: Google Account → Security → 2-Step Verification → App passwords
3. Generate an app password
4. Use the 16-character password in `EMAIL_PASSWORD`

---

## 🔒 Security Features

✅ **Token Hashing** - Tokens are hashed before storing in database  
✅ **Expiry** - Tokens expire after 1 hour  
✅ **One-time Use** - Token is cleared after successful reset  
✅ **No Email Enumeration** - Same response whether email exists or not  
✅ **Password Validation** - Minimum 8 characters required  
✅ **Secure Random** - Using crypto.randomBytes for token generation  

---

## 🧪 Testing

### **Test with cURL:**

```bash
# 1. Request password reset
curl -X POST https://promax-node-production-7c35.up.railway.app/api/password/forgot \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# 2. Check email for token

# 3. Reset password
curl -X POST https://promax-node-production-7c35.up.railway.app/api/password/reset \
  -H "Content-Type: application/json" \
  -d '{"token":"TOKEN_FROM_EMAIL","newPassword":"newPassword123"}'
```

---

## ❓ FAQ

**Q: How long is the reset link valid?**  
A: 1 hour from the time it's generated.

**Q: Can I use the same link twice?**  
A: No, the token is invalidated after successful password reset.

**Q: What if I don't receive the email?**  
A: Check spam folder. If still not received, request a new reset link.

**Q: Can I change the email template?**  
A: Yes, edit `/utils/emailService.js` to customize the HTML template.

**Q: How do I use a different email provider?**  
A: Update the transporter configuration in `/utils/emailService.js`. See the code comments for examples (SendGrid, AWS SES, etc.).

---

**Last Updated:** July 8, 2026  
**Version:** 1.0.0
