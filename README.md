<<<<<<< HEAD
# OneAI Platform

OneAI is a multi-service digital platform that combines user onboarding, premium payments, mobile recharge workflows, location tracking requests, staking, and admin management in one connected experience. The project is split between a static frontend hosted on GitHub Pages and a Node.js/Express backend hosted on Render with MongoDB for persistent data.

## Overview

This repository contains the full web application stack for OneAI:

- A polished frontend experience with pages such as landing, signup, dashboard, profile, support, tracker, recharge, staking, and admin views.
- A backend API for authentication, payments, premium services, recharge requests, tracker requests, vouchers, and admin actions.
- Real-time updates through WebSockets and notification support for new requests and status changes.

## Current Functionality

### User Experience

- Secure registration and login flow
- Admin approval-based access for new users
- Dashboard with service access cards and request history
- Profile page with referral information and voucher display
- Support and issue reporting flow
- Premium service payment workflow
- Mobile recharge and Fexiload submissions
- Location tracker service requests
- Staking and TRX-related actions

### Admin Operations

- User management and approval controls
- Payment review and transaction tracking
- Premium service management
- Fexiload request review
- Merchant issue handling
- Penalty report review
- Voucher generation and management
- Page/content management

## Tech Stack

### Frontend

- HTML, CSS, and vanilla JavaScript
- Static pages served through GitHub Pages
- Shared assets under the assets folder

### Backend

- Node.js with Express
- JWT-based authentication
- bcrypt for password hashing
- Helmet and rate limiting for basic API protection
- WebSockets for live updates
- Web Push support for notifications

### Data Layer

- MongoDB Atlas via Mongoose
- Models for users, payments, premium services, requests, vouchers, issues, penalties, and admin content

## Project Structure

- index.html, signup.html, dashboard.html, profile.html, tracker.html, fexiload.html, staking.html, support.html, admin.html
- assets/ for shared CSS, JavaScript, and web fonts
- middleware/ for authentication helpers
- models/ for MongoDB schemas and data models
- server.js for the main API and WebSocket server

## Local Development

### Requirements

- Node.js 20.x or newer
- npm
- MongoDB connection string
- JWT secret and other environment variables

### Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a .env file with the required variables, for example:
   ```env
   PORT=10000
   MONGODB_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret
   NODE_ENV=development
   ```
4. Start the backend:
   ```bash
   npm run dev
   ```

## Deployment Notes

- The frontend is designed for GitHub Pages deployment.
- The backend is intended for deployment on Render.
- CORS and WebSocket origins should be configured for the production frontend domain.
- The backend should be reachable from the frontend using the hosted Render API URL.

## Compatible Update Blueprint

The next major enhancement for OneAI should be a Data Broker / Order Management module that fits naturally into the current website rather than replacing any existing services. This blueprint is designed to work with the current structure of dashboard.html, server.js, the MongoDB models, and the existing authentication and payment flows.

### 1. Project Goal

Add a premium order-management experience that allows users to:

- View pending jobs and consignment activity
- Track order status in real time
- Use a credit-based system for order access
- Upgrade through simple subscription tiers
- Receive updates through the existing notification flow
- Keep everything connected to the current OneAI dashboard experience

### 2. Compatibility Principles

This update must remain fully compatible with the current platform by following these rules:

- Keep the frontend as static HTML pages and vanilla JavaScript
- Reuse the existing login and approval system
- Integrate the new feature into the current dashboard instead of building a separate product experience
- Reuse the current Express backend and MongoDB model patterns
- Keep payment-related actions aligned with the existing TRX and premium-service workflow
- Use the current WebSocket-based live update approach for new order events

### 3. Recommended Feature Modules

#### A. Data Broker Dashboard

- Add a new section or page for order management from the main dashboard
- Include cards for pending orders, active tracking, completed orders, and credits balance
- Reuse the existing dashboard styling and responsive layout system

#### B. Order Management Flow

- Fetch pending and active orders from the backend
- Allow users to sort, filter, and review orders by status or time
- Show status history for each order
- Support simple action flows such as accept, track, mark complete, or cancel

#### C. Credit and Subscription System

- Track usage through a credit balance attached to the user profile
- Allow users to purchase credits through the existing payment structure
- Add simple subscription options such as daily, weekly, and monthly access
- Keep the pricing logic simple and visible inside the dashboard

#### D. Live Updates and Notifications

- Push order status changes to the dashboard in real time
- Send notifications for major events like assignment, pickup, delivery, or failure
- Use the same WebSocket and notification patterns already present in the backend

#### E. Admin Oversight

- Give admins access to system-wide order activity
- Allow review of user credits and order usage
- Support moderation of failed orders and account-specific issues

### 4. Suggested Backend Structure

The backend update should be implemented in server.js using the same modular pattern already used for payments, premium services, tracker requests, and vouchers.

Recommended additions:

- New order-related routes under the existing API style
- New Mongoose models for broker orders, credit transactions, and subscription usage
- Middleware that checks user authentication and approval before order access
- WebSocket events for live status changes
- Error handling and validation patterns consistent with the current server

### 5. Suggested Frontend Integration

The frontend should be added in a way that feels native to the current website:

- Add a new service card on the dashboard for Data Broker
- Create a dedicated page or embedded section for order management
- Reuse the existing loading animation, alert system, and form styling
- Keep the interaction flow consistent with tracker.html, fexiload.html, and dashboard.html

### 6. Implementation Phases

#### Phase 1: Foundation

- Create the new data models and backend routes
- Connect the feature to the existing user authentication flow
- Add basic credit balance support

#### Phase 2: User Interface

- Build the dashboard view for order access and tracking
- Add filters, status labels, and action buttons
- Connect the page to the backend API

#### Phase 3: Real-Time Features

- Add WebSocket updates for live order changes
- Trigger notifications for update events
- Keep the dashboard responsive and live

#### Phase 4: Admin and Monitoring

- Add admin visibility for all broker activity
- Add reporting for credit usage and order lifecycle
- Ensure the feature remains stable and easy to manage

### 7. Compatibility Checklist

Before launching the update, confirm that:

- Existing login and signup flows still work
- Current dashboard services remain unaffected
- Existing payment routes continue to operate normally
- Admin pages remain functional with the new data included
- The new feature can be enabled without breaking the current site experience

## Notes

This README now serves as a compatible implementation guide for the next OneAI update. It is written to match the current website infrastructure and should be used as the reference for planning the Data Broker feature without disrupting the existing platform.
=======
OneAi Project backed by Hacker1


Java:
>>To check installed java versions: 
$ update-java-alternatives --list
>> To change java version using:
└─$ sudo update-alternatives --config java
>>
>>>>>>> origin/main
