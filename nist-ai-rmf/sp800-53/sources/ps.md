# Personnel Security <a id="ps"></a>

```
doc_id: sp800-53-rev5
nist_id: NIST.SP.800-53
version: 5.2.0
family: ps
doi: https://doi.org/10.6028/NIST.SP.800-53r5
disclaimer: Structured Markdown extract for demo retrieval. Not official NIST output.
```

## PS-1 Policy and Procedures <a id="ps-1"></a>

**Control.**

- Develop, document, and disseminate to [organization-defined personnel or roles]:
  - [PS-01_ODP[03]] personnel security policy that:
    - Addresses purpose, scope, roles, responsibilities, management commitment, coordination among organizational entities, and compliance; and
    - Is consistent with applicable laws, executive orders, directives, regulations, policies, standards, and guidelines; and
  - Procedures to facilitate the implementation of the personnel security policy and the associated personnel security controls;
- Designate an [PS-01_ODP[04]] to manage the development, documentation, and dissemination of the personnel security policy and procedures; and
- Review and update the current personnel security:
  - Policy [PS-01_ODP[05]] and following [PS-01_ODP[06]] ; and
  - Procedures [PS-01_ODP[07]] and following [PS-01_ODP[08]].

**Discussion.**

Personnel security policy and procedures for the controls in the PS family that are implemented within systems and organizations. The risk management strategy is an important factor in establishing such policies and procedures. Policies and procedures contribute to security and privacy assurance. Therefore, it is important that security and privacy programs collaborate on their development. Security and privacy program policies and procedures at the organization level are preferable, in general, and may obviate the need for mission level or system-specific policies and procedures. The policy can be included as part of the general security and privacy policy or be represented by multiple policies reflecting the complex nature of organizations. Procedures can be established for security and privacy programs, for mission/business processes, and for systems, if needed. Procedures describe how the policies or controls are implemented and can be directed at the individual or role that is the object of the procedure. Procedures can be documented in system security and privacy plans or in one or more separate documents. Events that may precipitate an update to personnel security policy and procedures include, but are not limited to, assessment or audit findings, security incidents or breaches, or changes in applicable laws, executive orders, directives, regulations, policies, standards, and guidelines. Simply restating controls does not constitute an organizational policy or procedure.

## PS-2 Position Risk Designation <a id="ps-2"></a>

**Control.**

- Assign a risk designation to all organizational positions;
- Establish screening criteria for individuals filling those positions; and
- Review and update position risk designations [PS-02_ODP].

**Discussion.**

Position risk designations reflect Office of Personnel Management (OPM) policy and guidance. Proper position designation is the foundation of an effective and consistent suitability and personnel security program. The Position Designation System (PDS) assesses the duties and responsibilities of a position to determine the degree of potential damage to the efficiency or integrity of the service due to misconduct of an incumbent of a position and establishes the risk level of that position. The PDS assessment also determines if the duties and responsibilities of the position present the potential for position incumbents to bring about a material adverse effect on national security and the degree of that potential effect, which establishes the sensitivity level of a position. The results of the assessment determine what level of investigation is conducted for a position. Risk designations can guide and inform the types of authorizations that individuals receive when accessing organizational information and information systems. Position screening criteria include explicit information security role appointment requirements. Parts 1400 and 731 of Title 5, Code of Federal Regulations, establish the requirements for organizations to evaluate relevant covered positions for a position sensitivity and position risk designation commensurate with the duties and responsibilities of those positions.

## PS-3 Personnel Screening <a id="ps-3"></a>

**Control.**

- Screen individuals prior to authorizing access to the system; and
- Rescreen individuals in accordance with [organization-defined conditions requiring rescreening and, where rescreening is so indicated, the frequency of rescreening].

**Discussion.**

Personnel screening and rescreening activities reflect applicable laws, executive orders, directives, regulations, policies, standards, guidelines, and specific criteria established for the risk designations of assigned positions. Examples of personnel screening include background investigations and agency checks. Organizations may define different rescreening conditions and frequencies for personnel accessing systems based on types of information processed, stored, or transmitted by the systems.

### PS-3(1) Classified Information <a id="ps-3.1"></a>

**Control.**

Verify that individuals accessing a system processing, storing, or transmitting classified information are cleared and indoctrinated to the highest classification level of the information to which they have access on the system.

**Discussion.**

Classified information is the most sensitive information that the Federal Government processes, stores, or transmits. It is imperative that individuals have the requisite security clearances and system access authorizations prior to gaining access to such information. Access authorizations are enforced by system access controls (see [AC-3](#ac-3) ) and flow controls (see [AC-4](#ac-4)).

### PS-3(2) Formal Indoctrination <a id="ps-3.2"></a>

**Control.**

Verify that individuals accessing a system processing, storing, or transmitting types of classified information that require formal indoctrination, are formally indoctrinated for all the relevant types of information to which they have access on the system.

**Discussion.**

Types of classified information that require formal indoctrination include Special Access Program (SAP), Restricted Data (RD), and Sensitive Compartmented Information (SCI).

### PS-3(3) Information Requiring Special Protective Measures <a id="ps-3.3"></a>

**Control.**

Verify that individuals accessing a system processing, storing, or transmitting information requiring special protection:
- Have valid access authorizations that are demonstrated by assigned official government duties; and
- Satisfy [PS-03(03)_ODP].

**Discussion.**

Organizational information that requires special protection includes controlled unclassified information. Personnel security criteria include position sensitivity background screening requirements.

### PS-3(4) Citizenship Requirements <a id="ps-3.4"></a>

**Control.**

Verify that individuals accessing a system processing, storing, or transmitting [PS-03(04)_ODP[01]] meet [PS-03(04)_ODP[02]].

**Discussion.**

None.

## PS-4 Personnel Termination <a id="ps-4"></a>

**Control.**

Upon termination of individual employment:
- Disable system access within [PS-04_ODP[01]];
- Terminate or revoke any authenticators and credentials associated with the individual;
- Conduct exit interviews that include a discussion of [PS-04_ODP[02]];
- Retrieve all security-related organizational system-related property; and
- Retain access to organizational information and systems formerly controlled by terminated individual.

**Discussion.**

System property includes hardware authentication tokens, system administration technical manuals, keys, identification cards, and building passes. Exit interviews ensure that terminated individuals understand the security constraints imposed by being former employees and that proper accountability is achieved for system-related property. Security topics at exit interviews include reminding individuals of nondisclosure agreements and potential limitations on future employment. Exit interviews may not always be possible for some individuals, including in cases related to the unavailability of supervisors, illnesses, or job abandonment. Exit interviews are important for individuals with security clearances. The timely execution of termination actions is essential for individuals who have been terminated for cause. In certain situations, organizations consider disabling the system accounts of individuals who are being terminated prior to the individuals being notified.

### PS-4(1) Post-employment Requirements <a id="ps-4.1"></a>

**Control.**

- Notify terminated individuals of applicable, legally binding post-employment requirements for the protection of organizational information; and
- Require terminated individuals to sign an acknowledgment of post-employment requirements as part of the organizational termination process.

**Discussion.**

Organizations consult with the Office of the General Counsel regarding matters of post-employment requirements on terminated individuals.

### PS-4(2) Automated Actions <a id="ps-4.2"></a>

**Control.**

Use [PS-04(02)_ODP[01]] to [PS-04(02)_ODP[02]].

**Discussion.**

In organizations with many employees, not all personnel who need to know about termination actions receive the appropriate notifications, or if such notifications are received, they may not occur in a timely manner. Automated mechanisms can be used to send automatic alerts or notifications to organizational personnel or roles when individuals are terminated. Such automatic alerts or notifications can be conveyed in a variety of ways, including via telephone, electronic mail, text message, or websites. Automated mechanisms can also be employed to quickly and thoroughly disable access to system resources after an employee is terminated.

## PS-5 Personnel Transfer <a id="ps-5"></a>

**Control.**

- Review and confirm ongoing operational need for current logical and physical access authorizations to systems and facilities when individuals are reassigned or transferred to other positions within the organization;
- Initiate [PS-05_ODP[01]] within [PS-05_ODP[02]];
- Modify access authorization as needed to correspond with any changes in operational need due to reassignment or transfer; and
- Notify [PS-05_ODP[03]] within [PS-05_ODP[04]].

**Discussion.**

Personnel transfer applies when reassignments or transfers of individuals are permanent or of such extended duration as to make the actions warranted. Organizations define actions appropriate for the types of reassignments or transfers, whether permanent or extended. Actions that may be required for personnel transfers or reassignments to other positions within organizations include returning old and issuing new keys, identification cards, and building passes; closing system accounts and establishing new accounts; changing system access authorizations (i.e., privileges); and providing for access to official records to which individuals had access at previous work locations and in previous system accounts.

## PS-6 Access Agreements <a id="ps-6"></a>

**Control.**

- Develop and document access agreements for organizational systems;
- Review and update the access agreements [PS-06_ODP[01]] ; and
- Verify that individuals requiring access to organizational information and systems:
  - Sign appropriate access agreements prior to being granted access; and
  - Re-sign access agreements to maintain access to organizational systems when access agreements have been updated or [PS-06_ODP[02]].

**Discussion.**

Access agreements include nondisclosure agreements, acceptable use agreements, rules of behavior, and conflict-of-interest agreements. Signed access agreements include an acknowledgement that individuals have read, understand, and agree to abide by the constraints associated with organizational systems to which access is authorized. Organizations can use electronic signatures to acknowledge access agreements unless specifically prohibited by organizational policy.

### PS-6(1) Information Requiring Special Protection <a id="ps-6.1"></a>

### PS-6(2) Classified Information Requiring Special Protection <a id="ps-6.2"></a>

**Control.**

Verify that access to classified information requiring special protection is granted only to individuals who:
- Have a valid access authorization that is demonstrated by assigned official government duties;
- Satisfy associated personnel security criteria; and
- Have read, understood, and signed a nondisclosure agreement.

**Discussion.**

Classified information that requires special protection includes collateral information, Special Access Program (SAP) information, and Sensitive Compartmented Information (SCI). Personnel security criteria reflect applicable laws, executive orders, directives, regulations, policies, standards, and guidelines.

### PS-6(3) Post-employment Requirements <a id="ps-6.3"></a>

**Control.**

- Notify individuals of applicable, legally binding post-employment requirements for protection of organizational information; and
- Require individuals to sign an acknowledgment of these requirements, if applicable, as part of granting initial access to covered information.

**Discussion.**

Organizations consult with the Office of the General Counsel regarding matters of post-employment requirements on terminated individuals.

## PS-7 External Personnel Security <a id="ps-7"></a>

**Control.**

- Establish personnel security requirements, including security roles and responsibilities for external providers;
- Require external providers to comply with personnel security policies and procedures established by the organization;
- Document personnel security requirements;
- Require external providers to notify [PS-07_ODP[01]] of any personnel transfers or terminations of external personnel who possess organizational credentials and/or badges, or who have system privileges within [PS-07_ODP[02]] ; and
- Monitor provider compliance with personnel security requirements.

**Discussion.**

External provider refers to organizations other than the organization operating or acquiring the system. External providers include service bureaus, contractors, and other organizations that provide system development, information technology services, testing or assessment services, outsourced applications, and network/security management. Organizations explicitly include personnel security requirements in acquisition-related documents. External providers may have personnel working at organizational facilities with credentials, badges, or system privileges issued by organizations. Notifications of external personnel changes ensure the appropriate termination of privileges and credentials. Organizations define the transfers and terminations deemed reportable by security-related characteristics that include functions, roles, and the nature of credentials or privileges associated with transferred or terminated individuals.

## PS-8 Personnel Sanctions <a id="ps-8"></a>

**Control.**

- Employ a formal sanctions process for individuals failing to comply with established information security and privacy policies and procedures; and
- Notify [PS-08_ODP[01]] within [PS-08_ODP[02]] when a formal employee sanctions process is initiated, identifying the individual sanctioned and the reason for the sanction.

**Discussion.**

Organizational sanctions reflect applicable laws, executive orders, directives, regulations, policies, standards, and guidelines. Sanctions processes are described in access agreements and can be included as part of general personnel policies for organizations and/or specified in security and privacy policies. Organizations consult with the Office of the General Counsel regarding matters of employee sanctions.

## PS-9 Position Descriptions <a id="ps-9"></a>

**Control.**

Incorporate security and privacy roles and responsibilities into organizational position descriptions.

**Discussion.**

Specification of security and privacy roles in individual organizational position descriptions facilitates clarity in understanding the security or privacy responsibilities associated with the roles and the role-based security and privacy training requirements for the roles.
