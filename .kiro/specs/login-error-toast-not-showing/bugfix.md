# Bugfix Requirements Document

## Introduction

The login page (`src/ui/login.html`) fails silently whenever an authentication
attempt is rejected. The renderer correctly catches the backend error
(e.g. `auth:login` returning `Invalid credentials` from
`src/main/auth.js#loginWithLocalPostgres`) and routes it through
`setError(mapLoginError(err))`, but `setError` delegates exclusively to
`showToast`, and `showToast` early-returns when it cannot find a
`#toast-container` element. The login page does not contain that element
(only `src/ui/index.html` does), so every error path on the login screen
produces no visible feedback. The user sees no toast, no inline message,
and no indication that anything went wrong, even though the inline
`<p id="login-error" class="error-text" role="alert">` paragraph already
exists in the markup as an error sink.

The impact is that all login-screen error paths are invisible to the
user: invalid credentials, unknown user, account lockout, OTP failures,
unrecognized cards, password-disabled accounts, missing-input
validations, and network/IPC errors. This bugfix restores visible error
feedback on the login page while preserving the existing toast behavior
on pages that already render correctly (notably `index.html`).

## Bug Analysis

### Current Behavior (Defect)

When the user is on the login page (`src/ui/login.html`) and any code
path calls `setError(message)` with a non-empty message, the message is
forwarded to `showToast`, which looks up `#toast-container`, finds
nothing (the element is absent from `login.html`), and returns early. No
toast is rendered, the inline `#login-error` paragraph is not updated,
and no other visible feedback is produced.

1.1 WHEN the user submits an incorrect password on the login page AND the backend rejects the attempt with `Invalid credentials` THEN the system displays no error message to the user
1.2 WHEN the user submits a username that does not exist THEN the system displays no error message to the user
1.3 WHEN the user submits an empty username, empty password, or invalid OTP and client-side validation calls `setError` with a message THEN the system displays no error message to the user
1.4 WHEN the account is locked out and `setError` is called with the remaining-lockout message THEN the system displays no countdown or lockout message to the user
1.5 WHEN OTP verification fails or any other login-page flow (card not recognized, password login disabled, network/IPC error) calls `setError` with a non-empty message THEN the system displays no error message to the user
1.6 WHEN any login-page error path runs THEN the inline `<p id="login-error">` element remains empty because `setError` does not update it
1.7 WHEN a screen reader or assistive technology is attached to the login page AND a login error occurs THEN the system announces nothing because no live region is updated

### Expected Behavior (Correct)

When `setError(message)` is invoked on the login page with a non-empty
message, the message must become visible to the user through some
on-page mechanism (e.g. populating the existing `#login-error` ARIA-live
paragraph, rendering a toast inside a login-page toast container, or an
equivalent visible affordance). When `setError('')` (or another
clearing call) is invoked, any previously displayed error must be
cleared.

2.1 WHEN the user submits an incorrect password on the login page AND the backend rejects the attempt with `Invalid credentials` THEN the system SHALL display a visible error message conveying the failure to the user
2.2 WHEN the user submits a username that does not exist THEN the system SHALL display a visible error message conveying the failure to the user
2.3 WHEN the user submits an empty username, empty password, or invalid OTP and client-side validation calls `setError` with a message THEN the system SHALL display that validation message to the user
2.4 WHEN the account is locked out and `setError` is called with the remaining-lockout message THEN the system SHALL display the lockout message to the user
2.5 WHEN OTP verification fails or any other login-page flow (card not recognized, password login disabled, network/IPC error) calls `setError` with a non-empty message THEN the system SHALL display that error message to the user
2.6 WHEN `setError('')` is called (e.g. on retry, on lockout expiry, or when resetting the form) THEN the system SHALL clear any previously displayed login-error message
2.7 WHEN any login-page error path runs THEN the system SHALL surface the message through an ARIA-live region (such as the existing `role="alert"` `#login-error` paragraph) so assistive technologies announce it

### Unchanged Behavior (Regression Prevention)

The fix must be confined to the login-page error-display pipeline. No
other behavior of the application is allowed to change.

3.1 WHEN the user submits valid credentials on the login page THEN the system SHALL CONTINUE TO authenticate the user and proceed past the login screen exactly as before
3.2 WHEN any code on `index.html` (the post-login app) calls `showToast` THEN the system SHALL CONTINUE TO render toasts using the existing `#toast-container` and existing toast styling on that page
3.3 WHEN the user-management module (`src/ui/js/user-management.js`) calls its own `showToast` helper THEN the system SHALL CONTINUE TO render those toasts unchanged
3.4 WHEN the backend processes any `auth:*` IPC handler (e.g. `auth:login`, `auth:verifyOtp`) THEN the system SHALL CONTINUE TO return the same payloads, error codes, and log messages as before
3.5 WHEN no error is currently active on the login page (initial load, after a successful retry, after lockout clears) THEN the system SHALL CONTINUE TO present an empty error region with no spurious message
3.6 WHEN the lockout timer is running, when the card-message helper is called, or when other non-error login-page UI updates occur THEN the system SHALL CONTINUE TO behave exactly as before
3.7 WHEN `setError` is called with an empty string AND no error is currently displayed THEN the system SHALL CONTINUE TO be a no-op with no visual change

## Bug Condition Derivation

### Bug Condition Function

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type LoginPageErrorEvent
         { page         : 'login.html' | other,
           message      : string,
           type         : 'error' | 'warning' | 'info',
           hasContainer : boolean   // is #toast-container present in DOM?
         }
  OUTPUT: boolean

  // The bug fires whenever the login page tries to surface a non-empty
  // error message and the renderer's error pipeline cannot find a
  // toast container (which is always the case on login.html today).
  RETURN X.page = 'login.html'
     AND X.message <> ''
     AND X.hasContainer = false
END FUNCTION
```

### Property Specification — Fix Checking

```pascal
// Property: Fix Checking - Login errors must be visible to the user
FOR ALL X WHERE isBugCondition(X) DO
  result ← setError'(X.message)              // F' = fixed renderer
  ASSERT user_visible_error_text(result) = X.message
     AND aria_live_region_announces(result, X.message)
     AND no_silent_dropping(result)
END FOR
```

### Property Specification — Preservation Checking

```pascal
// Property: Preservation Checking - Everything else is unchanged
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT F(X) = F'(X)
END FOR

// Concretely, the preserved cases include:
//   * X.page <> 'login.html'                  (index.html toasts unchanged)
//   * X.message = '' on login.html            (clearing remains a no-op /
//                                              clears any displayed error)
//   * X.hasContainer = true                   (any future page that does
//                                              ship a #toast-container keeps
//                                              the existing toast rendering)
//   * Successful login, OTP success, card success, lockout timer ticks,
//     and all backend auth:* IPC behavior.
```

### Counterexample

A concrete reproduction demonstrating the bug today:

1. Launch the app and reach `src/ui/login.html`.
2. Enter a known username and an incorrect password in the Admin
   Password modal.
3. Submit. The backend logs
   `Error occurred in handler for auth:login: Error: Invalid credentials`
   from `src/main/auth.js#loginWithLocalPostgres`.
4. The renderer's `catch` block runs `setError(mapLoginError(err))`,
   which calls `showToast(message, 'error')`.
5. `showToast` evaluates `var container = $('toast-container');` — the
   element does not exist in `login.html` — and executes
   `if (!container) return;`, dropping the message.
6. Observed: no toast, `#login-error` is empty, the modal shows no
   feedback. Expected: the user sees an "Invalid credentials" (or
   equivalent) message.
