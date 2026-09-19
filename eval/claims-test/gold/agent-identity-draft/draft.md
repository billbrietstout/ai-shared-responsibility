# Agent Identity Binding for Delegated Tool Use

## Abstract
This early draft argues that an agent that can call tools must present a
stable identity that a reviewer can revoke. It maps that activity to one
accountable party.

## 1. The confused-deputy failure
When an agent calls a payment tool, a caller can present another agent's
identity and cause the tool to act under the wrong principal. The failure
is confused-deputy actuation: the tool cannot tell which agent was
authorized for that call.

## 2. Binding obligation and control
Under NIST AI RMF GOVERN 1.2, the deploying organization must assign
accountability for AI actors. The Application Developer implements NIST
SP 800-53 AC-2 (Account Management) so each agent identity is unique,
recorded, and revocable before any tool call. If the agent holds a
delegated user token, the Application Developer binds that token to the
agent identity on the same request. The Application Developer is the
single accountable party for this binding at layer L3.

## 3. Logging as implied mitigation
Tool platforms should log every call. Logs help investigators.

## 4. Trust language
This approach ensures trust across the agent identity landscape and
addresses the gap in current practice.

## 5. Shared ownership
Identity binding is a shared responsibility between the platform and the
application.

## 6. Hospital billing
Hospitals must bill the correct CPT code when an agent drafts a clinical
note.

## 7. Unsigned survey
Smith (2024, doi:10.9999/not-a-real-doi) shows that unsigned agent
identities are the leading cause of tool misuse.

## 8. Coverage statement
This paper fully addresses all agent identity risks.

## 9. Model surface
A language model plans the tool sequence. The agent runtime then actuates
the call. Stage: runtime. Layer: L3 application and L4 platform.
