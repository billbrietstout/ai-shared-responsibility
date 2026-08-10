# Maintenance <a id="ma"></a>

```
doc_id: sp800-53-rev5
nist_id: NIST.SP.800-53
version: 5.2.0
family: ma
doi: https://doi.org/10.6028/NIST.SP.800-53r5
disclaimer: Structured Markdown extract for demo retrieval. Not official NIST output.
```

## MA-1 Policy and Procedures <a id="ma-1"></a>

**Control.**

- Develop, document, and disseminate to [organization-defined personnel or roles]:
  - [MA-01_ODP[03]] maintenance policy that:
    - Addresses purpose, scope, roles, responsibilities, management commitment, coordination among organizational entities, and compliance; and
    - Is consistent with applicable laws, executive orders, directives, regulations, policies, standards, and guidelines; and
  - Procedures to facilitate the implementation of the maintenance policy and the associated maintenance controls;
- Designate an [MA-01_ODP[04]] to manage the development, documentation, and dissemination of the maintenance policy and procedures; and
- Review and update the current maintenance:
  - Policy [MA-01_ODP[05]] and following [MA-01_ODP[06]] ; and
  - Procedures [MA-01_ODP[07]] and following [MA-01_ODP[08]].

**Discussion.**

Maintenance policy and procedures address the controls in the MA family that are implemented within systems and organizations. The risk management strategy is an important factor in establishing such policies and procedures. Policies and procedures contribute to security and privacy assurance. Therefore, it is important that security and privacy programs collaborate on the development of maintenance policy and procedures. Security and privacy program policies and procedures at the organization level are preferable, in general, and may obviate the need for mission- or system-specific policies and procedures. The policy can be included as part of the general security and privacy policy or be represented by multiple policies that reflect the complex nature of organizations. Procedures can be established for security and privacy programs, for mission or business processes, and for systems, if needed. Procedures describe how the policies or controls are implemented and can be directed at the individual or role that is the object of the procedure. Procedures can be documented in system security and privacy plans or in one or more separate documents. Events that may precipitate an update to maintenance policy and procedures assessment or audit findings, security incidents or breaches, or changes in applicable laws, executive orders, directives, regulations, policies, standards, and guidelines. Simply restating controls does not constitute an organizational policy or procedure.

## MA-2 Controlled Maintenance <a id="ma-2"></a>

**Control.**

- Schedule, document, and review records of maintenance, repair, and replacement on system components in accordance with manufacturer or vendor specifications and/or organizational requirements;
- Approve and monitor all maintenance activities, whether performed on site or remotely and whether the system or system components are serviced on site or removed to another location;
- Require that [MA-02_ODP[01]] explicitly approve the removal of the system or system components from organizational facilities for off-site maintenance, repair, or replacement;
- Sanitize equipment to remove the following information from associated media prior to removal from organizational facilities for off-site maintenance, repair, or replacement: [MA-02_ODP[02]];
- Check all potentially impacted controls to verify that the controls are still functioning properly following maintenance, repair, or replacement actions; and
- Include the following information in organizational maintenance records: [MA-02_ODP[03]].

**Discussion.**

Controlling system maintenance addresses the information security aspects of the system maintenance program and applies to all types of maintenance to system components conducted by local or nonlocal entities. Maintenance includes peripherals such as scanners, copiers, and printers. Information necessary for creating effective maintenance records includes the date and time of maintenance, a description of the maintenance performed, names of the individuals or group performing the maintenance, name of the escort, and system components or equipment that are removed or replaced. Organizations consider supply chain-related risks associated with replacement components for systems.

### MA-2(1) Record Content <a id="ma-2.1"></a>

### MA-2(2) Automated Maintenance Activities <a id="ma-2.2"></a>

**Control.**

- Schedule, conduct, and document maintenance, repair, and replacement actions for the system using [organization-defined automated mechanisms] ; and
- Produce up-to date, accurate, and complete records of all maintenance, repair, and replacement actions requested, scheduled, in process, and completed.

**Discussion.**

The use of automated mechanisms to manage and control system maintenance programs and activities helps to ensure the generation of timely, accurate, complete, and consistent maintenance records.

## MA-3 Maintenance Tools <a id="ma-3"></a>

**Control.**

- Approve, control, and monitor the use of system maintenance tools; and
- Review previously approved system maintenance tools [MA-03_ODP].

**Discussion.**

Approving, controlling, monitoring, and reviewing maintenance tools address security-related issues associated with maintenance tools that are not within system authorization boundaries and are used specifically for diagnostic and repair actions on organizational systems. Organizations have flexibility in determining roles for the approval of maintenance tools and how that approval is documented. A periodic review of maintenance tools facilitates the withdrawal of approval for outdated, unsupported, irrelevant, or no-longer-used tools. Maintenance tools can include hardware, software, and firmware items and may be pre-installed, brought in with maintenance personnel on media, cloud-based, or downloaded from a website. Such tools can be vehicles for transporting malicious code, either intentionally or unintentionally, into a facility and subsequently into systems. Maintenance tools can include hardware and software diagnostic test equipment and packet sniffers. The hardware and software components that support maintenance and are a part of the system (including the software implementing utilities such as "ping," "ls," "ipconfig," or the hardware and software implementing the monitoring port of an Ethernet switch) are not addressed by maintenance tools.

### MA-3(1) Inspect Tools <a id="ma-3.1"></a>

**Control.**

Inspect the maintenance tools used by maintenance personnel for improper or unauthorized modifications.

**Discussion.**

Maintenance tools can be directly brought into a facility by maintenance personnel or downloaded from a vendor’s website. If, upon inspection of the maintenance tools, organizations determine that the tools have been modified in an improper manner or the tools contain malicious code, the incident is handled consistent with organizational policies and procedures for incident handling.

### MA-3(2) Inspect Media <a id="ma-3.2"></a>

**Control.**

Check media containing diagnostic and test programs for malicious code before the media are used in the system.

**Discussion.**

If, upon inspection of media containing maintenance, diagnostic, and test programs, organizations determine that the media contains malicious code, the incident is handled consistent with organizational incident handling policies and procedures.

### MA-3(3) Prevent Unauthorized Removal <a id="ma-3.3"></a>

**Control.**

Prevent the removal of maintenance equipment containing organizational information by:
- Verifying that there is no organizational information contained on the equipment;
- Sanitizing or destroying the equipment;
- Retaining the equipment within the facility; or
- Obtaining an exemption from [MA-03(03)_ODP] explicitly authorizing removal of the equipment from the facility.

**Discussion.**

Organizational information includes all information owned by organizations and any information provided to organizations for which the organizations serve as information stewards.

### MA-3(4) Restricted Tool Use <a id="ma-3.4"></a>

**Control.**

Restrict the use of maintenance tools to authorized personnel only.

**Discussion.**

Restricting the use of maintenance tools to only authorized personnel applies to systems that are used to carry out maintenance functions.

### MA-3(5) Execution with Privilege <a id="ma-3.5"></a>

**Control.**

Monitor the use of maintenance tools that execute with increased privilege.

**Discussion.**

Maintenance tools that execute with increased system privilege can result in unauthorized access to organizational information and assets that would otherwise be inaccessible.

### MA-3(6) Software Updates and Patches <a id="ma-3.6"></a>

**Control.**

Inspect maintenance tools to ensure the latest software updates and patches are installed.

**Discussion.**

Maintenance tools using outdated and/or unpatched software can provide a threat vector for adversaries and result in a significant vulnerability for organizations.

## MA-4 Nonlocal Maintenance <a id="ma-4"></a>

**Control.**

- Approve and monitor nonlocal maintenance and diagnostic activities;
- Allow the use of nonlocal maintenance and diagnostic tools only as consistent with organizational policy and documented in the security plan for the system;
- Employ strong authentication in the establishment of nonlocal maintenance and diagnostic sessions;
- Maintain records for nonlocal maintenance and diagnostic activities; and
- Terminate session and network connections when nonlocal maintenance is completed.

**Discussion.**

Nonlocal maintenance and diagnostic activities are conducted by individuals who communicate through either an external or internal network. Local maintenance and diagnostic activities are carried out by individuals who are physically present at the system location and not communicating across a network connection. Authentication techniques used to establish nonlocal maintenance and diagnostic sessions reflect the network access requirements in [IA-2](#ia-2) . Strong authentication requires authenticators that are resistant to replay attacks and employ multi-factor authentication. Strong authenticators include PKI where certificates are stored on a token protected by a password, passphrase, or biometric. Enforcing requirements in [MA-4](#ma-4) is accomplished, in part, by other controls. [SP 800-63B](#e59c5a7c-8b1f-49ca-8de0-6ee0882180ce) provides additional guidance on strong authentication and authenticators.

### MA-4(1) Logging and Review <a id="ma-4.1"></a>

**Control.**

- Log [organization-defined audit events] for nonlocal maintenance and diagnostic sessions; and
- Review the audit records of the maintenance and diagnostic sessions to detect anomalous behavior.

**Discussion.**

Audit logging for nonlocal maintenance is enforced by [AU-2](#au-2) . Audit events are defined in [AU-2a](#au-2_smt.a).

### MA-4(2) Document Nonlocal Maintenance <a id="ma-4.2"></a>

### MA-4(3) Comparable Security and Sanitization <a id="ma-4.3"></a>

**Control.**

- Require that nonlocal maintenance and diagnostic services be performed from a system that implements a security capability comparable to the capability implemented on the system being serviced; or
- Remove the component to be serviced from the system prior to nonlocal maintenance or diagnostic services; sanitize the component (for organizational information); and after the service is performed, inspect and sanitize the component (for potentially malicious software) before reconnecting the component to the system.

**Discussion.**

Comparable security capability on systems, diagnostic tools, and equipment providing maintenance services implies that the implemented controls on those systems, tools, and equipment are at least as comprehensive as the controls on the system being serviced.

### MA-4(4) Authentication and Separation of Maintenance Sessions <a id="ma-4.4"></a>

**Control.**

Protect nonlocal maintenance sessions by:
- Employing [MA-04(04)_ODP] ; and
- Separating the maintenance sessions from other network sessions with the system by either:
  - Physically separated communications paths; or
  - Logically separated communications paths.

**Discussion.**

Communications paths can be logically separated using encryption.

### MA-4(5) Approvals and Notifications <a id="ma-4.5"></a>

**Control.**

- Require the approval of each nonlocal maintenance session by [MA-04(05)_ODP[01]] ; and
- Notify the following personnel or roles of the date and time of planned nonlocal maintenance: [MA-04(05)_ODP[02]].

**Discussion.**

Notification may be performed by maintenance personnel. Approval of nonlocal maintenance is accomplished by personnel with sufficient information security and system knowledge to determine the appropriateness of the proposed maintenance.

### MA-4(6) Cryptographic Protection <a id="ma-4.6"></a>

**Control.**

Implement the following cryptographic mechanisms to protect the integrity and confidentiality of nonlocal maintenance and diagnostic communications: [MA-04(06)_ODP].

**Discussion.**

Failure to protect nonlocal maintenance and diagnostic communications can result in unauthorized individuals gaining access to organizational information. Unauthorized access during remote maintenance sessions can result in a variety of hostile actions, including malicious code insertion, unauthorized changes to system parameters, and exfiltration of organizational information. Such actions can result in the loss or degradation of mission or business capabilities.

### MA-4(7) Disconnect Verification <a id="ma-4.7"></a>

**Control.**

Verify session and network connection termination after the completion of nonlocal maintenance and diagnostic sessions.

**Discussion.**

Verifying the termination of a connection once maintenance is completed ensures that connections established during nonlocal maintenance and diagnostic sessions have been terminated and are no longer available for use.

## MA-5 Maintenance Personnel <a id="ma-5"></a>

**Control.**

- Establish a process for maintenance personnel authorization and maintain a list of authorized maintenance organizations or personnel;
- Verify that non-escorted personnel performing maintenance on the system possess the required access authorizations; and
- Designate organizational personnel with required access authorizations and technical competence to supervise the maintenance activities of personnel who do not possess the required access authorizations.

**Discussion.**

Maintenance personnel refers to individuals who perform hardware or software maintenance on organizational systems, while [PE-2](#pe-2) addresses physical access for individuals whose maintenance duties place them within the physical protection perimeter of the systems. Technical competence of supervising individuals relates to the maintenance performed on the systems, while having required access authorizations refers to maintenance on and near the systems. Individuals not previously identified as authorized maintenance personnel—such as information technology manufacturers, vendors, systems integrators, and consultants—may require privileged access to organizational systems, such as when they are required to conduct maintenance activities with little or no notice. Based on organizational assessments of risk, organizations may issue temporary credentials to these individuals. Temporary credentials may be for one-time use or for very limited time periods.

### MA-5(1) Individuals Without Appropriate Access <a id="ma-5.1"></a>

**Control.**

- Implement procedures for the use of maintenance personnel that lack appropriate security clearances or are not U.S. citizens, that include the following requirements:
  - Maintenance personnel who do not have needed access authorizations, clearances, or formal access approvals are escorted and supervised during the performance of maintenance and diagnostic activities on the system by approved organizational personnel who are fully cleared, have appropriate access authorizations, and are technically qualified; and
  - Prior to initiating maintenance or diagnostic activities by personnel who do not have needed access authorizations, clearances or formal access approvals, all volatile information storage components within the system are sanitized and all nonvolatile storage media are removed or physically disconnected from the system and secured; and
- Develop and implement [MA-05(01)_ODP] in the event a system component cannot be sanitized, removed, or disconnected from the system.

**Discussion.**

Procedures for individuals who lack appropriate security clearances or who are not U.S. citizens are intended to deny visual and electronic access to classified or controlled unclassified information contained on organizational systems. Procedures for the use of maintenance personnel can be documented in security plans for the systems.

### MA-5(2) Security Clearances for Classified Systems <a id="ma-5.2"></a>

**Control.**

Verify that personnel performing maintenance and diagnostic activities on a system processing, storing, or transmitting classified information possess security clearances and formal access approvals for at least the highest classification level and for compartments of information on the system.

**Discussion.**

Personnel who conduct maintenance on organizational systems may be exposed to classified information during the course of their maintenance activities. To mitigate the inherent risk of such exposure, organizations use maintenance personnel that are cleared (i.e., possess security clearances) to the classification level of the information stored on the system.

### MA-5(3) Citizenship Requirements for Classified Systems <a id="ma-5.3"></a>

**Control.**

Verify that personnel performing maintenance and diagnostic activities on a system processing, storing, or transmitting classified information are U.S. citizens.

**Discussion.**

Personnel who conduct maintenance on organizational systems may be exposed to classified information during the course of their maintenance activities. If access to classified information on organizational systems is restricted to U.S. citizens, the same restriction is applied to personnel performing maintenance on those systems.

### MA-5(4) Foreign Nationals <a id="ma-5.4"></a>

**Control.**

Ensure that:
- Foreign nationals with appropriate security clearances are used to conduct maintenance and diagnostic activities on classified systems only when the systems are jointly owned and operated by the United States and foreign allied governments, or owned and operated solely by foreign allied governments; and
- Approvals, consents, and detailed operational conditions regarding the use of foreign nationals to conduct maintenance and diagnostic activities on classified systems are fully documented within Memoranda of Agreements.

**Discussion.**

Personnel who conduct maintenance and diagnostic activities on organizational systems may be exposed to classified information. If non-U.S. citizens are permitted to perform maintenance and diagnostics activities on classified systems, then additional vetting is required to ensure agreements and restrictions are not being violated.

### MA-5(5) Non-system Maintenance <a id="ma-5.5"></a>

**Control.**

Ensure that non-escorted personnel performing maintenance activities not directly associated with the system but in the physical proximity of the system, have required access authorizations.

**Discussion.**

Personnel who perform maintenance activities in other capacities not directly related to the system include physical plant personnel and custodial personnel.

## MA-6 Timely Maintenance <a id="ma-6"></a>

**Control.**

Obtain maintenance support and/or spare parts for [MA-06_ODP[01]] within [MA-06_ODP[02]] of failure.

**Discussion.**

Organizations specify the system components that result in increased risk to organizational operations and assets, individuals, other organizations, or the Nation when the functionality provided by those components is not operational. Organizational actions to obtain maintenance support include having appropriate contracts in place.

### MA-6(1) Preventive Maintenance <a id="ma-6.1"></a>

**Control.**

Perform preventive maintenance on [MA-06(01)_ODP[01]] at [MA-06(01)_ODP[02]].

**Discussion.**

Preventive maintenance includes proactive care and the servicing of system components to maintain organizational equipment and facilities in satisfactory operating condition. Such maintenance provides for the systematic inspection, tests, measurements, adjustments, parts replacement, detection, and correction of incipient failures either before they occur or before they develop into major defects. The primary goal of preventive maintenance is to avoid or mitigate the consequences of equipment failures. Preventive maintenance is designed to preserve and restore equipment reliability by replacing worn components before they fail. Methods of determining what preventive (or other) failure management policies to apply include original equipment manufacturer recommendations; statistical failure records; expert opinion; maintenance that has already been conducted on similar equipment; requirements of codes, laws, or regulations within a jurisdiction; or measured values and performance indications.

### MA-6(2) Predictive Maintenance <a id="ma-6.2"></a>

**Control.**

Perform predictive maintenance on [MA-06(02)_ODP[01]] at [MA-06(02)_ODP[02]].

**Discussion.**

Predictive maintenance evaluates the condition of equipment by performing periodic or continuous (online) equipment condition monitoring. The goal of predictive maintenance is to perform maintenance at a scheduled time when the maintenance activity is most cost-effective and before the equipment loses performance within a threshold. The predictive component of predictive maintenance stems from the objective of predicting the future trend of the equipment's condition. The predictive maintenance approach employs principles of statistical process control to determine at what point in the future maintenance activities will be appropriate. Most predictive maintenance inspections are performed while equipment is in service, thus minimizing disruption of normal system operations. Predictive maintenance can result in substantial cost savings and higher system reliability.

### MA-6(3) Automated Support for Predictive Maintenance <a id="ma-6.3"></a>

**Control.**

Transfer predictive maintenance data to a maintenance management system using [MA-06(03)_ODP].

**Discussion.**

A computerized maintenance management system maintains a database of information about the maintenance operations of organizations and automates the processing of equipment condition data to trigger maintenance planning, execution, and reporting.

## MA-7 Field Maintenance <a id="ma-7"></a>

**Control.**

Restrict or prohibit field maintenance on [MA-07_ODP[01]] to [MA-07_ODP[02]].

**Discussion.**

Field maintenance is the type of maintenance conducted on a system or system component after the system or component has been deployed to a specific site (i.e., operational environment). In certain instances, field maintenance (i.e., local maintenance at the site) may not be executed with the same degree of rigor or with the same quality control checks as depot maintenance. For critical systems designated as such by the organization, it may be necessary to restrict or prohibit field maintenance at the local site and require that such maintenance be conducted in trusted facilities with additional controls.
