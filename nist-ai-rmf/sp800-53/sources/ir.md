# Incident Response <a id="ir"></a>

```
doc_id: sp800-53-rev5
nist_id: NIST.SP.800-53
version: 5.2.0
family: ir
doi: https://doi.org/10.6028/NIST.SP.800-53r5
disclaimer: Structured Markdown extract for demo retrieval. Not official NIST output.
```

## IR-1 Policy and Procedures <a id="ir-1"></a>

**Control.**

- Develop, document, and disseminate to [organization-defined personnel or roles]:
  - [IR-01_ODP[03]] incident response policy that:
    - Addresses purpose, scope, roles, responsibilities, management commitment, coordination among organizational entities, and compliance; and
    - Is consistent with applicable laws, executive orders, directives, regulations, policies, standards, and guidelines; and
  - Procedures to facilitate the implementation of the incident response policy and the associated incident response controls;
- Designate an [IR-01_ODP[04]] to manage the development, documentation, and dissemination of the incident response policy and procedures; and
- Review and update the current incident response:
  - Policy [IR-01_ODP[05]] and following [IR-01_ODP[06]] ; and
  - Procedures [IR-01_ODP[07]] and following [IR-01_ODP[08]].

**Discussion.**

Incident response policy and procedures address the controls in the IR family that are implemented within systems and organizations. The risk management strategy is an important factor in establishing such policies and procedures. Policies and procedures contribute to security and privacy assurance. Therefore, it is important that security and privacy programs collaborate on the development of incident response policy and procedures. Security and privacy program policies and procedures at the organization level are preferable, in general, and may obviate the need for mission- or system-specific policies and procedures. The policy can be included as part of the general security and privacy policy or be represented by multiple policies that reflect the complex nature of organizations. Procedures can be established for security and privacy programs, for mission or business processes, and for systems, if needed. Procedures describe how the policies or controls are implemented and can be directed at the individual or role that is the object of the procedure. Procedures can be documented in system security and privacy plans or in one or more separate documents. Events that may precipitate an update to incident response policy and procedures include assessment or audit findings, security incidents or breaches, or changes in laws, executive orders, directives, regulations, policies, standards, and guidelines. Simply restating controls does not constitute an organizational policy or procedure.

## IR-2 Incident Response Training <a id="ir-2"></a>

**Control.**

- Provide incident response training to system users consistent with assigned roles and responsibilities:
  - Within [IR-02_ODP[01]] of assuming an incident response role or responsibility or acquiring system access;
  - When required by system changes; and
  - [IR-02_ODP[02]] thereafter; and
- Review and update incident response training content [IR-02_ODP[03]] and following [IR-02_ODP[04]].

**Discussion.**

Incident response training is associated with the assigned roles and responsibilities of organizational personnel to ensure that the appropriate content and level of detail are included in such training. For example, users may only need to know who to call or how to recognize an incident; system administrators may require additional training on how to handle incidents; and incident responders may receive more specific training on forensics, data collection techniques, reporting, system recovery, and system restoration. Incident response training includes user training in identifying and reporting suspicious activities from external and internal sources. Incident response training for users may be provided as part of [AT-2](#at-2) or [AT-3](#at-3) . Events that may precipitate an update to incident response training content include, but are not limited to, incident response plan testing or response to an actual incident (lessons learned), assessment or audit findings, or changes in applicable laws, executive orders, directives, regulations, policies, standards, and guidelines.

### IR-2(1) Simulated Events <a id="ir-2.1"></a>

**Control.**

Incorporate simulated events into incident response training to facilitate the required response by personnel in crisis situations.

**Discussion.**

Organizations establish requirements for responding to incidents in incident response plans. Incorporating simulated events into incident response training helps to ensure that personnel understand their individual responsibilities and what specific actions to take in crisis situations.

### IR-2(2) Automated Training Environments <a id="ir-2.2"></a>

**Control.**

Provide an incident response training environment using [IR-02(02)_ODP].

**Discussion.**

Automated mechanisms can provide a more thorough and realistic incident response training environment. This can be accomplished, for example, by providing more complete coverage of incident response issues, selecting more realistic training scenarios and environments, and stressing the response capability.

### IR-2(3) Breach <a id="ir-2.3"></a>

**Control.**

Provide incident response training on how to identify and respond to a breach, including the organization’s process for reporting a breach.

**Discussion.**

For federal agencies, an incident that involves personally identifiable information is considered a breach. A breach results in the loss of control, compromise, unauthorized disclosure, unauthorized acquisition, or a similar occurrence where a person other than an authorized user accesses or potentially accesses personally identifiable information or an authorized user accesses or potentially accesses such information for other than authorized purposes. The incident response training emphasizes the obligation of individuals to report both confirmed and suspected breaches involving information in any medium or form, including paper, oral, and electronic. Incident response training includes tabletop exercises that simulate a breach. See [IR-2(1)](#ir-2.1).

## IR-3 Incident Response Testing <a id="ir-3"></a>

**Control.**

Test the effectiveness of the incident response capability for the system [IR-03_ODP[01]] using the following tests: [IR-03_ODP[02]].

**Discussion.**

Organizations test incident response capabilities to determine their effectiveness and identify potential weaknesses or deficiencies. Incident response testing includes the use of checklists, walk-through or tabletop exercises, and simulations (parallel or full interrupt). Incident response testing can include a determination of the effects on organizational operations and assets and individuals due to incident response. The use of qualitative and quantitative data aids in determining the effectiveness of incident response processes.

### IR-3(1) Automated Testing <a id="ir-3.1"></a>

**Control.**

Test the incident response capability using [IR-03(01)_ODP].

**Discussion.**

Organizations use automated mechanisms to more thoroughly and effectively test incident response capabilities. This can be accomplished by providing more complete coverage of incident response issues, selecting realistic test scenarios and environments, and stressing the response capability.

### IR-3(2) Coordination with Related Plans <a id="ir-3.2"></a>

**Control.**

Coordinate incident response testing with organizational elements responsible for related plans.

**Discussion.**

Organizational plans related to incident response testing include business continuity plans, disaster recovery plans, continuity of operations plans, contingency plans, crisis communications plans, critical infrastructure plans, and occupant emergency plans.

### IR-3(3) Continuous Improvement <a id="ir-3.3"></a>

**Control.**

Use qualitative and quantitative data from testing to:
- Determine the effectiveness of incident response processes;
- Continuously improve incident response processes; and
- Provide incident response measures and metrics that are accurate, consistent, and in a reproducible format.

**Discussion.**

To help incident response activities function as intended, organizations may use metrics and evaluation criteria to assess incident response programs as part of an effort to continually improve response performance. These efforts facilitate improvement in incident response efficacy and lessen the impact of incidents.

## IR-4 Incident Handling <a id="ir-4"></a>

**Control.**

- Implement an incident handling capability for incidents that is consistent with the incident response plan and includes preparation, detection and analysis, containment, eradication, and recovery;
- Coordinate incident handling activities with contingency planning activities;
- Incorporate lessons learned from ongoing incident handling activities into incident response procedures, training, and testing, and implement the resulting changes accordingly; and
- Ensure the rigor, intensity, scope, and results of incident handling activities are comparable and predictable across the organization.

**Discussion.**

Organizations recognize that incident response capabilities are dependent on the capabilities of organizational systems and the mission and business processes being supported by those systems. Organizations consider incident response as part of the definition, design, and development of mission and business processes and systems. Incident-related information can be obtained from a variety of sources, including audit monitoring, physical access monitoring, and network monitoring; user or administrator reports; and reported supply chain events. An effective incident handling capability includes coordination among many organizational entities (e.g., mission or business owners, system owners, authorizing officials, human resources offices, physical security offices, personnel security offices, legal departments, risk executive [function], operations personnel, procurement offices). Suspected security incidents include the receipt of suspicious email communications that can contain malicious code. Suspected supply chain incidents include the insertion of counterfeit hardware or malicious code into organizational systems or system components. For federal agencies, an incident that involves personally identifiable information is considered a breach. A breach results in unauthorized disclosure, the loss of control, unauthorized acquisition, compromise, or a similar occurrence where a person other than an authorized user accesses or potentially accesses personally identifiable information or an authorized user accesses or potentially accesses such information for other than authorized purposes.

### IR-4(1) Automated Incident Handling Processes <a id="ir-4.1"></a>

**Control.**

Support the incident handling process using [IR-04(01)_ODP].

**Discussion.**

Automated mechanisms that support incident handling processes include online incident management systems and tools that support the collection of live response data, full network packet capture, and forensic analysis.

### IR-4(2) Dynamic Reconfiguration <a id="ir-4.2"></a>

**Control.**

Include the following types of dynamic reconfiguration for [IR-04(02)_ODP[02]] as part of the incident response capability: [IR-04(02)_ODP[01]].

**Discussion.**

Dynamic reconfiguration includes changes to router rules, access control lists, intrusion detection or prevention system parameters, and filter rules for guards or firewalls. Organizations may perform dynamic reconfiguration of systems to stop attacks, misdirect attackers, and isolate components of systems, thus limiting the extent of the damage from breaches or compromises. Organizations include specific time frames for achieving the reconfiguration of systems in the definition of the reconfiguration capability, considering the potential need for rapid response to effectively address cyber threats.

### IR-4(3) Continuity of Operations <a id="ir-4.3"></a>

**Control.**

Identify [IR-04(03)_ODP[01]] and take the following actions in response to those incidents to ensure continuation of organizational mission and business functions: [IR-04(03)_ODP[02]].

**Discussion.**

Classes of incidents include malfunctions due to design or implementation errors and omissions, targeted malicious attacks, and untargeted malicious attacks. Incident response actions include orderly system degradation, system shutdown, fall back to manual mode or activation of alternative technology whereby the system operates differently, employing deceptive measures, alternate information flows, or operating in a mode that is reserved for when systems are under attack. Organizations consider whether continuity of operations requirements during an incident conflict with the capability to automatically disable the system as specified as part of [IR-4(5)](#ir-4.5).

### IR-4(4) Information Correlation <a id="ir-4.4"></a>

**Control.**

Correlate incident information and individual incident responses to achieve an organization-wide perspective on incident awareness and response.

**Discussion.**

Sometimes, a threat event, such as a hostile cyber-attack, can only be observed by bringing together information from different sources, including various reports and reporting procedures established by organizations.

### IR-4(5) Automatic Disabling of System <a id="ir-4.5"></a>

**Control.**

Implement a configurable capability to automatically disable the system if [IR-04(05)_ODP] are detected.

**Discussion.**

Organizations consider whether the capability to automatically disable the system conflicts with continuity of operations requirements specified as part of [CP-2](#cp-2) or [IR-4(3)](#ir-4.3) . Security violations include cyber-attacks that have compromised the integrity of the system or exfiltrated organizational information and serious errors in software programs that could adversely impact organizational missions or functions or jeopardize the safety of individuals.

### IR-4(6) Insider Threats <a id="ir-4.6"></a>

**Control.**

Implement an incident handling capability for incidents involving insider threats.

**Discussion.**

Explicit focus on handling incidents involving insider threats provides additional emphasis on this type of threat and the need for specific incident handling capabilities to provide appropriate and timely responses.

### IR-4(7) Insider Threats — Intra-organization Coordination <a id="ir-4.7"></a>

**Control.**

Coordinate an incident handling capability for insider threats that includes the following organizational entities [IR-04(07)_ODP].

**Discussion.**

Incident handling for insider threat incidents (e.g., preparation, detection and analysis, containment, eradication, and recovery) requires coordination among many organizational entities, including mission or business owners, system owners, human resources offices, procurement offices, personnel offices, physical security offices, senior agency information security officer, operations personnel, risk executive (function), senior agency official for privacy, and legal counsel. In addition, organizations may require external support from federal, state, and local law enforcement agencies.

### IR-4(8) Correlation with External Organizations <a id="ir-4.8"></a>

**Control.**

Coordinate with [IR-04(08)_ODP[01]] to correlate and share [IR-04(08)_ODP[02]] to achieve a cross-organization perspective on incident awareness and more effective incident responses.

**Discussion.**

The coordination of incident information with external organizations—including mission or business partners, military or coalition partners, customers, and developers—can provide significant benefits. Cross-organizational coordination can serve as an important risk management capability. This capability allows organizations to leverage information from a variety of sources to effectively respond to incidents and breaches that could potentially affect the organization’s operations, assets, and individuals.

### IR-4(9) Dynamic Response Capability <a id="ir-4.9"></a>

**Control.**

Employ [IR-04(09)_ODP] to respond to incidents.

**Discussion.**

The dynamic response capability addresses the timely deployment of new or replacement organizational capabilities in response to incidents. This includes capabilities implemented at the mission and business process level and at the system level.

### IR-4(10) Supply Chain Coordination <a id="ir-4.10"></a>

**Control.**

Coordinate incident handling activities involving supply chain events with other organizations involved in the supply chain.

**Discussion.**

Organizations involved in supply chain activities include product developers, system integrators, manufacturers, packagers, assemblers, distributors, vendors, and resellers. Supply chain incidents can occur anywhere through or to the supply chain and include compromises or breaches that involve primary or sub-tier providers, information technology products, system components, development processes or personnel, and distribution processes or warehousing facilities. Organizations consider including processes for protecting and sharing incident information in information exchange agreements and their obligations for reporting incidents to government oversight bodies (e.g., Federal Acquisition Security Council).

### IR-4(11) Integrated Incident Response Team <a id="ir-4.11"></a>

**Control.**

Establish and maintain an integrated incident response team that can be deployed to any location identified by the organization in [IR-04(11)_ODP].

**Discussion.**

An integrated incident response team is a team of experts that assesses, documents, and responds to incidents so that organizational systems and networks can recover quickly and implement the necessary controls to avoid future incidents. Incident response team personnel include forensic and malicious code analysts, tool developers, systems security and privacy engineers, and real-time operations personnel. The incident handling capability includes performing rapid forensic preservation of evidence and analysis of and response to intrusions. For some organizations, the incident response team can be a cross-organizational entity.

An integrated incident response team facilitates information sharing and allows organizational personnel (e.g., developers, implementers, and operators) to leverage team knowledge of the threat and implement defensive measures that enable organizations to deter intrusions more effectively. Moreover, integrated teams promote the rapid detection of intrusions, the development of appropriate mitigations, and the deployment of effective defensive measures. For example, when an intrusion is detected, the integrated team can rapidly develop an appropriate response for operators to implement, correlate the new incident with information on past intrusions, and augment ongoing cyber intelligence development. Integrated incident response teams are better able to identify adversary tactics, techniques, and procedures that are linked to the operations tempo or specific mission and business functions and to define responsive actions in a way that does not disrupt those mission and business functions. Incident response teams can be distributed within organizations to make the capability resilient.

### IR-4(12) Malicious Code and Forensic Analysis <a id="ir-4.12"></a>

**Control.**

Analyze malicious code and/or other residual artifacts remaining in the system after the incident.

**Discussion.**

When conducted carefully in an isolated environment, analysis of malicious code and other residual artifacts of a security incident or breach can give the organization insight into adversary tactics, techniques, and procedures. It can also indicate the identity or some defining characteristics of the adversary. In addition, malicious code analysis can help the organization develop responses to future incidents.

### IR-4(13) Behavior Analysis <a id="ir-4.13"></a>

**Control.**

Analyze anomalous or suspected adversarial behavior in or related to [IR-04(13)_ODP].

**Discussion.**

If the organization maintains a deception environment, an analysis of behaviors in that environment, including resources targeted by the adversary and timing of the incident or event, can provide insight into adversarial tactics, techniques, and procedures. External to a deception environment, the analysis of anomalous adversarial behavior (e.g., changes in system performance or usage patterns) or suspected behavior (e.g., changes in searches for the location of specific resources) can give the organization such insight.

### IR-4(14) Security Operations Center <a id="ir-4.14"></a>

**Control.**

Establish and maintain a security operations center.

**Discussion.**

A security operations center (SOC) is the focal point for security operations and computer network defense for an organization. The purpose of the SOC is to defend and monitor an organization’s systems and networks (i.e., cyber infrastructure) on an ongoing basis. The SOC is also responsible for detecting, analyzing, and responding to cybersecurity incidents in a timely manner. The organization staffs the SOC with skilled technical and operational personnel (e.g., security analysts, incident response personnel, systems security engineers) and implements a combination of technical, management, and operational controls (including monitoring, scanning, and forensics tools) to monitor, fuse, correlate, analyze, and respond to threat and security-relevant event data from multiple sources. These sources include perimeter defenses, network devices (e.g., routers, switches), and endpoint agent data feeds. The SOC provides a holistic situational awareness capability to help organizations determine the security posture of the system and organization. A SOC capability can be obtained in a variety of ways. Larger organizations may implement a dedicated SOC while smaller organizations may employ third-party organizations to provide such a capability.

### IR-4(15) Public Relations and Reputation Repair <a id="ir-4.15"></a>

**Control.**

- Manage public relations associated with an incident; and
- Employ measures to repair the reputation of the organization.

**Discussion.**

It is important for an organization to have a strategy in place for addressing incidents that have been brought to the attention of the general public, have cast the organization in a negative light, or have affected the organization’s constituents (e.g., partners, customers). Such publicity can be extremely harmful to the organization and affect its ability to carry out its mission and business functions. Taking proactive steps to repair the organization’s reputation is an essential aspect of reestablishing the trust and confidence of its constituents.

## IR-5 Incident Monitoring <a id="ir-5"></a>

**Control.**

Track and document incidents.

**Discussion.**

Documenting incidents includes maintaining records about each incident, the status of the incident, and other pertinent information necessary for forensics as well as evaluating incident details, trends, and handling. Incident information can be obtained from a variety of sources, including network monitoring, incident reports, incident response teams, user complaints, supply chain partners, audit monitoring, physical access monitoring, and user and administrator reports. [IR-4](#ir-4) provides information on the types of incidents that are appropriate for monitoring.

### IR-5(1) Automated Tracking, Data Collection, and Analysis <a id="ir-5.1"></a>

**Control.**

Track incidents and collect and analyze incident information using [organization-defined automated mechanisms].

**Discussion.**

Automated mechanisms for tracking incidents and collecting and analyzing incident information include Computer Incident Response Centers or other electronic databases of incidents and network monitoring devices.

## IR-6 Incident Reporting <a id="ir-6"></a>

**Control.**

- Require personnel to report suspected incidents to the organizational incident response capability within [IR-06_ODP[01]] ; and
- Report incident information to [IR-06_ODP[02]].

**Discussion.**

The types of incidents reported, the content and timeliness of the reports, and the designated reporting authorities reflect applicable laws, executive orders, directives, regulations, policies, standards, and guidelines. Incident information can inform risk assessments, control effectiveness assessments, security requirements for acquisitions, and selection criteria for technology products.

### IR-6(1) Automated Reporting <a id="ir-6.1"></a>

**Control.**

Report incidents using [IR-06(01)_ODP].

**Discussion.**

The recipients of incident reports are specified in [IR-6b](#ir-6_smt.b) . Automated reporting mechanisms include email, posting on websites (with automatic updates), and automated incident response tools and programs.

### IR-6(2) Vulnerabilities Related to Incidents <a id="ir-6.2"></a>

**Control.**

Report system vulnerabilities associated with reported incidents to [IR-06(02)_ODP].

**Discussion.**

Reported incidents that uncover system vulnerabilities are analyzed by organizational personnel including system owners, mission and business owners, senior agency information security officers, senior agency officials for privacy, authorizing officials, and the risk executive (function). The analysis can serve to prioritize and initiate mitigation actions to address the discovered system vulnerability.

### IR-6(3) Supply Chain Coordination <a id="ir-6.3"></a>

**Control.**

Provide incident information to the provider of the product or service and other organizations involved in the supply chain or supply chain governance for systems or system components related to the incident.

**Discussion.**

Organizations involved in supply chain activities include product developers, system integrators, manufacturers, packagers, assemblers, distributors, vendors, and resellers. Entities that provide supply chain governance include the Federal Acquisition Security Council (FASC). Supply chain incidents include compromises or breaches that involve information technology products, system components, development processes or personnel, distribution processes, or warehousing facilities. Organizations determine the appropriate information to share and consider the value gained from informing external organizations about supply chain incidents, including the ability to improve processes or to identify the root cause of an incident.

## IR-7 Incident Response Assistance <a id="ir-7"></a>

**Control.**

Provide an incident response support resource, integral to the organizational incident response capability, that offers advice and assistance to users of the system for the handling and reporting of incidents.

**Discussion.**

Incident response support resources provided by organizations include help desks, assistance groups, automated ticketing systems to open and track incident response tickets, and access to forensics services or consumer redress services, when required.

### IR-7(1) Automation Support for Availability of Information and Support <a id="ir-7.1"></a>

**Control.**

Increase the availability of incident response information and support using [IR-07(01)_ODP].

**Discussion.**

Automated mechanisms can provide a push or pull capability for users to obtain incident response assistance. For example, individuals may have access to a website to query the assistance capability, or the assistance capability can proactively send incident response information to users (general distribution or targeted) as part of increasing understanding of current response capabilities and support.

### IR-7(2) Coordination with External Providers <a id="ir-7.2"></a>

**Control.**

- Establish a direct, cooperative relationship between its incident response capability and external providers of system protection capability; and
- Identify organizational incident response team members to the external providers.

**Discussion.**

External providers of a system protection capability include the Computer Network Defense program within the U.S. Department of Defense. External providers help to protect, monitor, analyze, detect, and respond to unauthorized activity within organizational information systems and networks. It may be beneficial to have agreements in place with external providers to clarify the roles and responsibilities of each party before an incident occurs.

## IR-8 Incident Response Plan <a id="ir-8"></a>

**Control.**

- Develop an incident response plan that:
  - Provides the organization with a roadmap for implementing its incident response capability;
  - Describes the structure and organization of the incident response capability;
  - Provides a high-level approach for how the incident response capability fits into the overall organization;
  - Meets the unique requirements of the organization, which relate to mission, size, structure, and functions;
  - Defines reportable incidents;
  - Provides metrics for measuring the incident response capability within the organization;
  - Defines the resources and management support needed to effectively maintain and mature an incident response capability;
  - Addresses the sharing of incident information;
  - Is reviewed and approved by [IR-08_ODP[01]] [IR-08_ODP[02]] ; and
  - Explicitly designates responsibility for incident response to [IR-08_ODP[03]].
- Distribute copies of the incident response plan to [IR-08_ODP[04]];
- Update the incident response plan to address system and organizational changes or problems encountered during plan implementation, execution, or testing;
- Communicate incident response plan changes to [organization-defined incident response personnel (identified by name and/or by role) and organizational elements] ; and
- Protect the incident response plan from unauthorized disclosure and modification.

**Discussion.**

It is important that organizations develop and implement a coordinated approach to incident response. Organizational mission and business functions determine the structure of incident response capabilities. As part of the incident response capabilities, organizations consider the coordination and sharing of information with external organizations, including external service providers and other organizations involved in the supply chain. For incidents involving personally identifiable information (i.e., breaches), include a process to determine whether notice to oversight organizations or affected individuals is appropriate and provide that notice accordingly.

### IR-8(1) Breaches <a id="ir-8.1"></a>

**Control.**

Include the following in the Incident Response Plan for breaches involving personally identifiable information:
- A process to determine if notice to individuals or other organizations, including oversight organizations, is needed;
- An assessment process to determine the extent of the harm, embarrassment, inconvenience, or unfairness to affected individuals and any mechanisms to mitigate such harms; and
- Identification of applicable privacy requirements.

**Discussion.**

Organizations may be required by law, regulation, or policy to follow specific procedures relating to breaches, including notice to individuals, affected organizations, and oversight bodies; standards of harm; and mitigation or other specific requirements.

## IR-9 Information Spillage Response <a id="ir-9"></a>

**Control.**

Respond to information spills by:
- Assigning [IR-09_ODP[01]] with responsibility for responding to information spills;
- Identifying the specific information involved in the system contamination;
- Alerting [IR-09_ODP[02]] of the information spill using a method of communication not associated with the spill;
- Isolating the contaminated system or system component;
- Eradicating the information from the contaminated system or component;
- Identifying other systems or system components that may have been subsequently contaminated; and
- Performing the following additional actions: [IR-09_ODP[03]].

**Discussion.**

Information spillage refers to instances where information is placed on systems that are not authorized to process such information. Information spills occur when information that is thought to be a certain classification or impact level is transmitted to a system and subsequently is determined to be of a higher classification or impact level. At that point, corrective action is required. The nature of the response is based on the classification or impact level of the spilled information, the security capabilities of the system, the specific nature of the contaminated storage media, and the access authorizations of individuals with authorized access to the contaminated system. The methods used to communicate information about the spill after the fact do not involve methods directly associated with the actual spill to minimize the risk of further spreading the contamination before such contamination is isolated and eradicated.

### IR-9(1) Responsible Personnel <a id="ir-9.1"></a>

### IR-9(2) Training <a id="ir-9.2"></a>

**Control.**

Provide information spillage response training [IR-09(02)_ODP].

**Discussion.**

Organizations establish requirements for responding to information spillage incidents in incident response plans. Incident response training on a regular basis helps to ensure that organizational personnel understand their individual responsibilities and what specific actions to take when spillage incidents occur.

### IR-9(3) Post-spill Operations <a id="ir-9.3"></a>

**Control.**

Implement the following procedures to ensure that organizational personnel impacted by information spills can continue to carry out assigned tasks while contaminated systems are undergoing corrective actions: [IR-09(03)_ODP].

**Discussion.**

Corrective actions for systems contaminated due to information spillages may be time-consuming. Personnel may not have access to the contaminated systems while corrective actions are being taken, which may potentially affect their ability to conduct organizational business.

### IR-9(4) Exposure to Unauthorized Personnel <a id="ir-9.4"></a>

**Control.**

Employ the following controls for personnel exposed to information not within assigned access authorizations: [IR-09(04)_ODP].

**Discussion.**

Controls include ensuring that personnel who are exposed to spilled information are made aware of the laws, executive orders, directives, regulations, policies, standards, and guidelines regarding the information and the restrictions imposed based on exposure to such information.

## IR-10 Integrated Information Security Analysis Team <a id="ir-10"></a>
