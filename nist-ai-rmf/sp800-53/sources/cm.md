# Configuration Management <a id="cm"></a>

```
doc_id: sp800-53-rev5
nist_id: NIST.SP.800-53
version: 5.2.0
family: cm
doi: https://doi.org/10.6028/NIST.SP.800-53r5
disclaimer: Structured Markdown extract for demo retrieval. Not official NIST output.
```

## CM-1 Policy and Procedures <a id="cm-1"></a>

**Control.**

- Develop, document, and disseminate to [organization-defined personnel or roles]:
  - [CM-01_ODP[03]] configuration management policy that:
    - Addresses purpose, scope, roles, responsibilities, management commitment, coordination among organizational entities, and compliance; and
    - Is consistent with applicable laws, executive orders, directives, regulations, policies, standards, and guidelines; and
  - Procedures to facilitate the implementation of the configuration management policy and the associated configuration management controls;
- Designate an [CM-01_ODP[04]] to manage the development, documentation, and dissemination of the configuration management policy and procedures; and
- Review and update the current configuration management:
  - Policy [CM-01_ODP[05]] and following [CM-01_ODP[06]] ; and
  - Procedures [CM-01_ODP[07]] and following [CM-01_ODP[08]].

**Discussion.**

Configuration management policy and procedures address the controls in the CM family that are implemented within systems and organizations. The risk management strategy is an important factor in establishing such policies and procedures. Policies and procedures contribute to security and privacy assurance. Therefore, it is important that security and privacy programs collaborate on the development of configuration management policy and procedures. Security and privacy program policies and procedures at the organization level are preferable, in general, and may obviate the need for mission- or system-specific policies and procedures. The policy can be included as part of the general security and privacy policy or be represented by multiple policies that reflect the complex nature of organizations. Procedures can be established for security and privacy programs, for mission/business processes, and for systems, if needed. Procedures describe how the policies or controls are implemented and can be directed at the individual or role that is the object of the procedure. Procedures can be documented in system security and privacy plans or in one or more separate documents. Events that may precipitate an update to configuration management policy and procedures include, but are not limited to, assessment or audit findings, security incidents or breaches, or changes in applicable laws, executive orders, directives, regulations, policies, standards, and guidelines. Simply restating controls does not constitute an organizational policy or procedure.

## CM-2 Baseline Configuration <a id="cm-2"></a>

**Control.**

- Develop, document, and maintain under configuration control, a current baseline configuration of the system; and
- Review and update the baseline configuration of the system:
  - [CM-02_ODP[01]];
  - When required due to [CM-02_ODP[02]] ; and
  - When system components are installed or upgraded.

**Discussion.**

Baseline configurations for systems and system components include connectivity, operational, and communications aspects of systems. Baseline configurations are documented, formally reviewed, and agreed-upon specifications for systems or configuration items within those systems. Baseline configurations serve as a basis for future builds, releases, or changes to systems and include security and privacy control implementations, operational procedures, information about system components, network topology, and logical placement of components in the system architecture. Maintaining baseline configurations requires creating new baselines as organizational systems change over time. Baseline configurations of systems reflect the current enterprise architecture.

### CM-2(1) Reviews and Updates <a id="cm-2.1"></a>

### CM-2(2) Automation Support for Accuracy and Currency <a id="cm-2.2"></a>

**Control.**

Maintain the currency, completeness, accuracy, and availability of the baseline configuration of the system using [CM-02(02)_ODP].

**Discussion.**

Automated mechanisms that help organizations maintain consistent baseline configurations for systems include configuration management tools, hardware, software, firmware inventory tools, and network management tools. Automated tools can be used at the organization level, mission and business process level, or system level on workstations, servers, notebook computers, network components, or mobile devices. Tools can be used to track version numbers on operating systems, applications, types of software installed, and current patch levels. Automation support for accuracy and currency can be satisfied by the implementation of [CM-8(2)](#cm-8.2) for organizations that combine system component inventory and baseline configuration activities.

### CM-2(3) Retention of Previous Configurations <a id="cm-2.3"></a>

**Control.**

Retain [CM-02(03)_ODP] of previous versions of baseline configurations of the system to support rollback.

**Discussion.**

Retaining previous versions of baseline configurations to support rollback include hardware, software, firmware, configuration files, configuration records, and associated documentation.

### CM-2(4) Unauthorized Software <a id="cm-2.4"></a>

### CM-2(5) Authorized Software <a id="cm-2.5"></a>

### CM-2(6) Development and Test Environments <a id="cm-2.6"></a>

**Control.**

Maintain a baseline configuration for system development and test environments that is managed separately from the operational baseline configuration.

**Discussion.**

Establishing separate baseline configurations for development, testing, and operational environments protects systems from unplanned or unexpected events related to development and testing activities. Separate baseline configurations allow organizations to apply the configuration management that is most appropriate for each type of configuration. For example, the management of operational configurations typically emphasizes the need for stability, while the management of development or test configurations requires greater flexibility. Configurations in the test environment mirror configurations in the operational environment to the extent practicable so that the results of the testing are representative of the proposed changes to the operational systems. Separate baseline configurations do not necessarily require separate physical environments.

### CM-2(7) Configure Systems and Components for High-risk Areas <a id="cm-2.7"></a>

**Control.**

- Issue [CM-02(07)_ODP[01]] with [CM-02(07)_ODP[02]] to individuals traveling to locations that the organization deems to be of significant risk; and
- Apply the following controls to the systems or components when the individuals return from travel: [CM-02(07)_ODP[03]].

**Discussion.**

When it is known that systems or system components will be in high-risk areas external to the organization, additional controls may be implemented to counter the increased threat in such areas. For example, organizations can take actions for notebook computers used by individuals departing on and returning from travel. Actions include determining the locations that are of concern, defining the required configurations for the components, ensuring that components are configured as intended before travel is initiated, and applying controls to the components after travel is completed. Specially configured notebook computers include computers with sanitized hard drives, limited applications, and more stringent configuration settings. Controls applied to mobile devices upon return from travel include examining the mobile device for signs of physical tampering and purging and reimaging disk drives. Protecting information that resides on mobile devices is addressed in the [MP](#mp) (Media Protection) family.

## CM-3 Configuration Change Control <a id="cm-3"></a>

**Control.**

- Determine and document the types of changes to the system that are configuration-controlled;
- Review proposed configuration-controlled changes to the system and approve or disapprove such changes with explicit consideration for security and privacy impact analyses;
- Document configuration change decisions associated with the system;
- Implement approved configuration-controlled changes to the system;
- Retain records of configuration-controlled changes to the system for [CM-03_ODP[01]];
- Monitor and review activities associated with configuration-controlled changes to the system; and
- Coordinate and provide oversight for configuration change control activities through [CM-03_ODP[02]] that convenes [CM-03_ODP[03]].

**Discussion.**

Configuration change control for organizational systems involves the systematic proposal, justification, implementation, testing, review, and disposition of system changes, including system upgrades and modifications. Configuration change control includes changes to baseline configurations, configuration items of systems, operational procedures, configuration settings for system components, remediate vulnerabilities, and unscheduled or unauthorized changes. Processes for managing configuration changes to systems include Configuration Control Boards or Change Advisory Boards that review and approve proposed changes. For changes that impact privacy risk, the senior agency official for privacy updates privacy impact assessments and system of records notices. For new systems or major upgrades, organizations consider including representatives from the development organizations on the Configuration Control Boards or Change Advisory Boards. Auditing of changes includes activities before and after changes are made to systems and the auditing activities required to implement such changes. See also [SA-10](#sa-10).

### CM-3(1) Automated Documentation, Notification, and Prohibition of Changes <a id="cm-3.1"></a>

**Control.**

Use [CM-03(01)_ODP[01]] to:
- Document proposed changes to the system;
- Notify [CM-03(01)_ODP[02]] of proposed changes to the system and request change approval;
- Highlight proposed changes to the system that have not been approved or disapproved within [CM-03(01)_ODP[03]];
- Prohibit changes to the system until designated approvals are received;
- Document all changes to the system; and
- Notify [CM-03(01)_ODP[04]] when approved changes to the system are completed.

**Discussion.**

None.

### CM-3(2) Testing, Validation, and Documentation of Changes <a id="cm-3.2"></a>

**Control.**

Test, validate, and document changes to the system before finalizing the implementation of the changes.

**Discussion.**

Changes to systems include modifications to hardware, software, or firmware components and configuration settings defined in [CM-6](#cm-6) . Organizations ensure that testing does not interfere with system operations that support organizational mission and business functions. Individuals or groups conducting tests understand security and privacy policies and procedures, system security and privacy policies and procedures, and the health, safety, and environmental risks associated with specific facilities or processes. Operational systems may need to be taken offline, or replicated to the extent feasible, before testing can be conducted. If systems must be taken offline for testing, the tests are scheduled to occur during planned system outages whenever possible. If the testing cannot be conducted on operational systems, organizations employ compensating controls.

### CM-3(3) Automated Change Implementation <a id="cm-3.3"></a>

**Control.**

Implement changes to the current system baseline and deploy the updated baseline across the installed base using [CM-03(03)_ODP].

**Discussion.**

Automated tools can improve the accuracy, consistency, and availability of configuration baseline information. Automation can also provide data aggregation and data correlation capabilities, alerting mechanisms, and dashboards to support risk-based decision-making within the organization.

### CM-3(4) Security and Privacy Representatives <a id="cm-3.4"></a>

**Control.**

Require [organization-defined security and privacy representatives] to be members of the [CM-03(04)_ODP[03]].

**Discussion.**

Information security and privacy representatives include system security officers, senior agency information security officers, senior agency officials for privacy, or system privacy officers. Representation by personnel with information security and privacy expertise is important because changes to system configurations can have unintended side effects, some of which may be security- or privacy-relevant. Detecting such changes early in the process can help avoid unintended, negative consequences that could ultimately affect the security and privacy posture of systems. The configuration change control element referred to in the second organization-defined parameter reflects the change control elements defined by organizations in [CM-3g](#cm-3_smt.g).

### CM-3(5) Automated Security Response <a id="cm-3.5"></a>

**Control.**

Implement the following security responses automatically if baseline configurations are changed in an unauthorized manner: [CM-03(05)_ODP].

**Discussion.**

Automated security responses include halting selected system functions, halting system processing, and issuing alerts or notifications to organizational personnel when there is an unauthorized modification of a configuration item.

### CM-3(6) Cryptography Management <a id="cm-3.6"></a>

**Control.**

Ensure that cryptographic mechanisms used to provide the following controls are under configuration management: [CM-03(06)_ODP].

**Discussion.**

The controls referenced in the control enhancement refer to security and privacy controls from the control catalog. Regardless of the cryptographic mechanisms employed, processes and procedures are in place to manage those mechanisms. For example, if system components use certificates for identification and authentication, a process is implemented to address the expiration of those certificates.

### CM-3(7) Review System Changes <a id="cm-3.7"></a>

**Control.**

Review changes to the system [CM-03(07)_ODP[01]] or when [CM-03(07)_ODP[02]] to determine whether unauthorized changes have occurred.

**Discussion.**

Indications that warrant a review of changes to the system and the specific circumstances justifying such reviews may be obtained from activities carried out by organizations during the configuration change process or continuous monitoring process.

### CM-3(8) Prevent or Restrict Configuration Changes <a id="cm-3.8"></a>

**Control.**

Prevent or restrict changes to the configuration of the system under the following circumstances: [CM-03(08)_ODP].

**Discussion.**

System configuration changes can adversely affect critical system security and privacy functionality. Change restrictions can be enforced through automated mechanisms.

## CM-4 Impact Analyses <a id="cm-4"></a>

**Control.**

Analyze changes to the system to determine potential security and privacy impacts prior to change implementation.

**Discussion.**

Organizational personnel with security or privacy responsibilities conduct impact analyses. Individuals conducting impact analyses possess the necessary skills and technical expertise to analyze the changes to systems as well as the security or privacy ramifications. Impact analyses include reviewing security and privacy plans, policies, and procedures to understand control requirements; reviewing system design documentation and operational procedures to understand control implementation and how specific system changes might affect the controls; reviewing the impact of changes on organizational supply chain partners with stakeholders; and determining how potential changes to a system create new risks to the privacy of individuals and the ability of implemented controls to mitigate those risks. Impact analyses also include risk assessments to understand the impact of the changes and determine if additional controls are required.

### CM-4(1) Separate Test Environments <a id="cm-4.1"></a>

**Control.**

Analyze changes to the system in a separate test environment before implementation in an operational environment, looking for security and privacy impacts due to flaws, weaknesses, incompatibility, or intentional malice.

**Discussion.**

A separate test environment requires an environment that is physically or logically separate and distinct from the operational environment. The separation is sufficient to ensure that activities in the test environment do not impact activities in the operational environment and that information in the operational environment is not inadvertently transmitted to the test environment. Separate environments can be achieved by physical or logical means. If physically separate test environments are not implemented, organizations determine the strength of mechanism required when implementing logical separation.

### CM-4(2) Verification of Controls <a id="cm-4.2"></a>

**Control.**

After system changes, verify that the impacted controls are implemented correctly, operating as intended, and producing the desired outcome with regard to meeting the security and privacy requirements for the system.

**Discussion.**

Implementation in this context refers to installing changed code in the operational system that may have an impact on security or privacy controls.

## CM-5 Access Restrictions for Change <a id="cm-5"></a>

**Control.**

Define, document, approve, and enforce physical and logical access restrictions associated with changes to the system.

**Discussion.**

Changes to the hardware, software, or firmware components of systems or the operational procedures related to the system can potentially have significant effects on the security of the systems or individuals’ privacy. Therefore, organizations permit only qualified and authorized individuals to access systems for purposes of initiating changes. Access restrictions include physical and logical access controls (see [AC-3](#ac-3) and [PE-3](#pe-3) ), software libraries, workflow automation, media libraries, abstract layers (i.e., changes implemented into external interfaces rather than directly into systems), and change windows (i.e., changes occur only during specified times).

### CM-5(1) Automated Access Enforcement and Audit Records <a id="cm-5.1"></a>

**Control.**

- Enforce access restrictions using [CM-05(01)_ODP] ; and
- Automatically generate audit records of the enforcement actions.

**Discussion.**

Organizations log system accesses associated with applying configuration changes to ensure that configuration change control is implemented and to support after-the-fact actions should organizations discover any unauthorized changes.

### CM-5(2) Review System Changes <a id="cm-5.2"></a>

### CM-5(3) Signed Components <a id="cm-5.3"></a>

### CM-5(4) Dual Authorization <a id="cm-5.4"></a>

**Control.**

Enforce dual authorization for implementing changes to [organization-defined system components and system-level information].

**Discussion.**

Organizations employ dual authorization to help ensure that any changes to selected system components and information cannot occur unless two qualified individuals approve and implement such changes. The two individuals possess the skills and expertise to determine if the proposed changes are correct implementations of approved changes. The individuals are also accountable for the changes. Dual authorization may also be known as two-person control. To reduce the risk of collusion, organizations consider rotating dual authorization duties to other individuals. System-level information includes operational procedures.

### CM-5(5) Privilege Limitation for Production and Operation <a id="cm-5.5"></a>

**Control.**

- Limit privileges to change system components and system-related information within a production or operational environment; and
- Review and reevaluate privileges [organization-defined frequency].

**Discussion.**

In many organizations, systems support multiple mission and business functions. Limiting privileges to change system components with respect to operational systems is necessary because changes to a system component may have far-reaching effects on mission and business processes supported by the system. The relationships between systems and mission/business processes are, in some cases, unknown to developers. System-related information includes operational procedures.

### CM-5(6) Limit Library Privileges <a id="cm-5.6"></a>

**Control.**

Limit privileges to change software resident within software libraries.

**Discussion.**

Software libraries include privileged programs.

### CM-5(7) Automatic Implementation of Security Safeguards <a id="cm-5.7"></a>

## CM-6 Configuration Settings <a id="cm-6"></a>

**Control.**

- Establish and document configuration settings for components employed within the system that reflect the most restrictive mode consistent with operational requirements using [CM-06_ODP[01]];
- Implement the configuration settings;
- Identify, document, and approve any deviations from established configuration settings for [CM-06_ODP[02]] based on [CM-06_ODP[03]] ; and
- Monitor and control changes to the configuration settings in accordance with organizational policies and procedures.

**Discussion.**

Configuration settings are the parameters that can be changed in the hardware, software, or firmware components of the system that affect the security and privacy posture or functionality of the system. Information technology products for which configuration settings can be defined include mainframe computers, servers, workstations, operating systems, mobile devices, input/output devices, protocols, and applications. Parameters that impact the security posture of systems include registry settings; account, file, or directory permission settings; and settings for functions, protocols, ports, services, and remote connections. Privacy parameters are parameters impacting the privacy posture of systems, including the parameters required to satisfy other privacy controls. Privacy parameters include settings for access controls, data processing preferences, and processing and retention permissions. Organizations establish organization-wide configuration settings and subsequently derive specific configuration settings for systems. The established settings become part of the configuration baseline for the system.

Common secure configurations (also known as security configuration checklists, lockdown and hardening guides, and security reference guides) provide recognized, standardized, and established benchmarks that stipulate secure configuration settings for information technology products and platforms as well as instructions for configuring those products or platforms to meet operational requirements. Common secure configurations can be developed by a variety of organizations, including information technology product developers, manufacturers, vendors, federal agencies, consortia, academia, industry, and other organizations in the public and private sectors.

Implementation of a common secure configuration may be mandated at the organization level, mission and business process level, system level, or at a higher level, including by a regulatory agency. Common secure configurations include the United States Government Configuration Baseline [USGCB](#98498928-3ca3-44b3-8b1e-f48685373087) and security technical implementation guides (STIGs), which affect the implementation of [CM-6](#cm-6) and other controls such as [AC-19](#ac-19) and [CM-7](#cm-7) . The Security Content Automation Protocol (SCAP) and the defined standards within the protocol provide an effective method to uniquely identify, track, and control configuration settings.

### CM-6(1) Automated Management, Application, and Verification <a id="cm-6.1"></a>

**Control.**

Manage, apply, and verify configuration settings for [CM-06(01)_ODP[01]] using [organization-defined automated mechanisms].

**Discussion.**

Automated tools (e.g., hardening tools, baseline configuration tools) can improve the accuracy, consistency, and availability of configuration settings information. Automation can also provide data aggregation and data correlation capabilities, alerting mechanisms, and dashboards to support risk-based decision-making within the organization.

### CM-6(2) Respond to Unauthorized Changes <a id="cm-6.2"></a>

**Control.**

Take the following actions in response to unauthorized changes to [CM-06(02)_ODP[02]]: [CM-06(02)_ODP[01]].

**Discussion.**

Responses to unauthorized changes to configuration settings include alerting designated organizational personnel, restoring established configuration settings, or—in extreme cases—halting affected system processing.

### CM-6(3) Unauthorized Change Detection <a id="cm-6.3"></a>

### CM-6(4) Conformance Demonstration <a id="cm-6.4"></a>

## CM-7 Least Functionality <a id="cm-7"></a>

**Control.**

- Configure the system to provide only [CM-07_ODP[01]] ; and
- Prohibit or restrict the use of the following functions, ports, protocols, software, and/or services: [organization-defined prohibited or restricted functions, system ports, protocols, software, and/or services].

**Discussion.**

Systems provide a wide variety of functions and services. Some of the functions and services routinely provided by default may not be necessary to support essential organizational missions, functions, or operations. Additionally, it is sometimes convenient to provide multiple services from a single system component, but doing so increases risk over limiting the services provided by that single component. Where feasible, organizations limit component functionality to a single function per component. Organizations consider removing unused or unnecessary software and disabling unused or unnecessary physical and logical ports and protocols to prevent unauthorized connection of components, transfer of information, and tunneling. Organizations employ network scanning tools, intrusion detection and prevention systems, and end-point protection technologies, such as firewalls and host-based intrusion detection systems, to identify and prevent the use of prohibited functions, protocols, ports, and services. Least functionality can also be achieved as part of the fundamental design and development of the system (see [SA-8](#sa-8), [SC-2](#sc-2) , and [SC-3](#sc-3)).

### CM-7(1) Periodic Review <a id="cm-7.1"></a>

**Control.**

- Review the system [CM-07(01)_ODP[01]] to identify unnecessary and/or nonsecure functions, ports, protocols, software, and services; and
- Disable or remove [organization-defined functions, ports, protocols, software, and services within the system deemed to be unnecessary and/or nonsecure].

**Discussion.**

Organizations review functions, ports, protocols, and services provided by systems or system components to determine the functions and services that are candidates for elimination. Such reviews are especially important during transition periods from older technologies to newer technologies (e.g., transition from IPv4 to IPv6). These technology transitions may require implementing the older and newer technologies simultaneously during the transition period and returning to minimum essential functions, ports, protocols, and services at the earliest opportunity. Organizations can either decide the relative security of the function, port, protocol, and/or service or base the security decision on the assessment of other entities. Unsecure protocols include Bluetooth, FTP, and peer-to-peer networking.

### CM-7(2) Prevent Program Execution <a id="cm-7.2"></a>

**Control.**

Prevent program execution in accordance with [CM-07(02)_ODP[01]].

**Discussion.**

Prevention of program execution addresses organizational policies, rules of behavior, and/or access agreements that restrict software usage and the terms and conditions imposed by the developer or manufacturer, including software licensing and copyrights. Restrictions include prohibiting auto-execute features, restricting roles allowed to approve program execution, permitting or prohibiting specific software programs, or restricting the number of program instances executed at the same time.

### CM-7(3) Registration Compliance <a id="cm-7.3"></a>

**Control.**

Ensure compliance with [CM-07(03)_ODP].

**Discussion.**

Organizations use the registration process to manage, track, and provide oversight for systems and implemented functions, ports, protocols, and services.

### CM-7(4) Unauthorized Software — Deny-by-exception <a id="cm-7.4"></a>

**Control.**

- Identify [CM-07(04)_ODP[01]];
- Employ an allow-all, deny-by-exception policy to prohibit the execution of unauthorized software programs on the system; and
- Review and update the list of unauthorized software programs [CM-07(04)_ODP[02]].

**Discussion.**

Unauthorized software programs can be limited to specific versions or from a specific source. The concept of prohibiting the execution of unauthorized software may also be applied to user actions, system ports and protocols, IP addresses/ranges, websites, and MAC addresses.

### CM-7(5) Authorized Software — Allow-by-exception <a id="cm-7.5"></a>

**Control.**

- Identify [CM-07(05)_ODP[01]];
- Employ a deny-all, permit-by-exception policy to allow the execution of authorized software programs on the system; and
- Review and update the list of authorized software programs [CM-07(05)_ODP[02]].

**Discussion.**

Authorized software programs can be limited to specific versions or from a specific source. To facilitate a comprehensive authorized software process and increase the strength of protection for attacks that bypass application level authorized software, software programs may be decomposed into and monitored at different levels of detail. These levels include applications, application programming interfaces, application modules, scripts, system processes, system services, kernel functions, registries, drivers, and dynamic link libraries. The concept of permitting the execution of authorized software may also be applied to user actions, system ports and protocols, IP addresses/ranges, websites, and MAC addresses. Organizations consider verifying the integrity of authorized software programs using digital signatures, cryptographic checksums, or hash functions. Verification of authorized software can occur either prior to execution or at system startup. The identification of authorized URLs for websites is addressed in [CA-3(5)](#ca-3.5) and [SC-7](#sc-7).

### CM-7(6) Confined Environments with Limited Privileges <a id="cm-7.6"></a>

**Control.**

Require that the following user-installed software execute in a confined physical or virtual machine environment with limited privileges: [CM-07(06)_ODP].

**Discussion.**

Organizations identify software that may be of concern regarding its origin or potential for containing malicious code. For this type of software, user installations occur in confined environments of operation to limit or contain damage from malicious code that may be executed.

### CM-7(7) Code Execution in Protected Environments <a id="cm-7.7"></a>

**Control.**

Allow execution of binary or machine-executable code only in confined physical or virtual machine environments and with the explicit approval of [CM-07(07)_ODP] when such code is:
- Obtained from sources with limited or no warranty; and/or
- Without the provision of source code.

**Discussion.**

Code execution in protected environments applies to all sources of binary or machine-executable code, including commercial software and firmware and open-source software.

### CM-7(8) Binary or Machine Executable Code <a id="cm-7.8"></a>

**Control.**

- Prohibit the use of binary or machine-executable code from sources with limited or no warranty or without the provision of source code; and
- Allow exceptions only for compelling mission or operational requirements and with the approval of the authorizing official.

**Discussion.**

Binary or machine executable code applies to all sources of binary or machine-executable code, including commercial software and firmware and open-source software. Organizations assess software products without accompanying source code or from sources with limited or no warranty for potential security impacts. The assessments address the fact that software products without the provision of source code may be difficult to review, repair, or extend. In addition, there may be no owners to make such repairs on behalf of organizations. If open-source software is used, the assessments address the fact that there is no warranty, the open-source software could contain back doors or malware, and there may be no support available.

### CM-7(9) Prohibiting The Use of Unauthorized Hardware <a id="cm-7.9"></a>

**Control.**

- Identify [CM-07(09)_ODP[01]];
- Prohibit the use or connection of unauthorized hardware components;
- Review and update the list of authorized hardware components [CM-07(09)_ODP[02]].

**Discussion.**

Hardware components provide the foundation for organizational systems and the platform for the execution of authorized software programs. Managing the inventory of hardware components and controlling which hardware components are permitted to be installed or connected to organizational systems is essential in order to provide adequate security.

## CM-8 System Component Inventory <a id="cm-8"></a>

**Control.**

- Develop and document an inventory of system components that:
  - Accurately reflects the system;
  - Includes all components within the system;
  - Does not include duplicate accounting of components or components assigned to any other system;
  - Is at the level of granularity deemed necessary for tracking and reporting; and
  - Includes the following information to achieve system component accountability: [CM-08_ODP[01]] ; and
- Review and update the system component inventory [CM-08_ODP[02]].

**Discussion.**

System components are discrete, identifiable information technology assets that include hardware, software, and firmware. Organizations may choose to implement centralized system component inventories that include components from all organizational systems. In such situations, organizations ensure that the inventories include system-specific information required for component accountability. The information necessary for effective accountability of system components includes the system name, software owners, software version numbers, hardware inventory specifications, software license information, and for networked components, the machine names and network addresses across all implemented protocols (e.g., IPv4, IPv6). Inventory specifications include date of receipt, cost, model, serial number, manufacturer, supplier information, component type, and physical location.

Preventing duplicate accounting of system components addresses the lack of accountability that occurs when component ownership and system association is not known, especially in large or complex connected systems. Effective prevention of duplicate accounting of system components necessitates use of a unique identifier for each component. For software inventory, centrally managed software that is accessed via other systems is addressed as a component of the system on which it is installed and managed. Software installed on multiple organizational systems and managed at the system level is addressed for each individual system and may appear more than once in a centralized component inventory, necessitating a system association for each software instance in the centralized inventory to avoid duplicate accounting of components. Scanning systems implementing multiple network protocols (e.g., IPv4 and IPv6) can result in duplicate components being identified in different address spaces. The implementation of [CM-8(7)](#cm-8.7) can help to eliminate duplicate accounting of components.

### CM-8(1) Updates During Installation and Removal <a id="cm-8.1"></a>

**Control.**

Update the inventory of system components as part of component installations, removals, and system updates.

**Discussion.**

Organizations can improve the accuracy, completeness, and consistency of system component inventories if the inventories are updated as part of component installations or removals or during general system updates. If inventories are not updated at these key times, there is a greater likelihood that the information will not be appropriately captured and documented. System updates include hardware, software, and firmware components.

### CM-8(2) Automated Maintenance <a id="cm-8.2"></a>

**Control.**

Maintain the currency, completeness, accuracy, and availability of the inventory of system components using [organization-defined automated mechanisms].

**Discussion.**

Organizations maintain system inventories to the extent feasible. For example, virtual machines can be difficult to monitor because such machines are not visible to the network when not in use. In such cases, organizations maintain as up-to-date, complete, and accurate an inventory as is deemed reasonable. Automated maintenance can be achieved by the implementation of [CM-2(2)](#cm-2.2) for organizations that combine system component inventory and baseline configuration activities.

### CM-8(3) Automated Unauthorized Component Detection <a id="cm-8.3"></a>

**Control.**

- Detect the presence of unauthorized hardware, software, and firmware components within the system using [organization-defined automated mechanisms] [CM-08(03)_ODP[04]] ; and
- Take the following actions when unauthorized components are detected: [CM-08(03)_ODP[05]].

**Discussion.**

Automated unauthorized component detection is applied in addition to the monitoring for unauthorized remote connections and mobile devices. Monitoring for unauthorized system components may be accomplished on an ongoing basis or by the periodic scanning of systems for that purpose. Automated mechanisms may also be used to prevent the connection of unauthorized components (see [CM-7(9)](#cm-7.9) ). Automated mechanisms can be implemented in systems or in separate system components. When acquiring and implementing automated mechanisms, organizations consider whether such mechanisms depend on the ability of the system component to support an agent or supplicant in order to be detected since some types of components do not have or cannot support agents (e.g., IoT devices, sensors). Isolation can be achieved , for example, by placing unauthorized system components in separate domains or subnets or quarantining such components. This type of component isolation is commonly referred to as "sandboxing."

### CM-8(4) Accountability Information <a id="cm-8.4"></a>

**Control.**

Include in the system component inventory information, a means for identifying by [CM-08(04)_ODP] , individuals responsible and accountable for administering those components.

**Discussion.**

Identifying individuals who are responsible and accountable for administering system components ensures that the assigned components are properly administered and that organizations can contact those individuals if some action is required (e.g., when the component is determined to be the source of a breach, needs to be recalled or replaced, or needs to be relocated).

### CM-8(5) No Duplicate Accounting of Components <a id="cm-8.5"></a>

### CM-8(6) Assessed Configurations and Approved Deviations <a id="cm-8.6"></a>

**Control.**

Include assessed component configurations and any approved deviations to current deployed configurations in the system component inventory.

**Discussion.**

Assessed configurations and approved deviations focus on configuration settings established by organizations for system components, the specific components that have been assessed to determine compliance with the required configuration settings, and any approved deviations from established configuration settings.

### CM-8(7) Centralized Repository <a id="cm-8.7"></a>

**Control.**

Provide a centralized repository for the inventory of system components.

**Discussion.**

Organizations may implement centralized system component inventories that include components from all organizational systems. Centralized repositories of component inventories provide opportunities for efficiencies in accounting for organizational hardware, software, and firmware assets. Such repositories may also help organizations rapidly identify the location and responsible individuals of components that have been compromised, breached, or are otherwise in need of mitigation actions. Organizations ensure that the resulting centralized inventories include system-specific information required for proper component accountability.

### CM-8(8) Automated Location Tracking <a id="cm-8.8"></a>

**Control.**

Support the tracking of system components by geographic location using [CM-08(08)_ODP].

**Discussion.**

The use of automated mechanisms to track the location of system components can increase the accuracy of component inventories. Such capability may help organizations rapidly identify the location and responsible individuals of system components that have been compromised, breached, or are otherwise in need of mitigation actions. The use of tracking mechanisms can be coordinated with senior agency officials for privacy if there are implications that affect individual privacy.

### CM-8(9) Assignment of Components to Systems <a id="cm-8.9"></a>

**Control.**

- Assign system components to a system; and
- Receive an acknowledgement from [CM-08(09)_ODP] of this assignment.

**Discussion.**

System components that are not assigned to a system may be unmanaged, lack the required protection, and become an organizational vulnerability.

## CM-9 Configuration Management Plan <a id="cm-9"></a>

**Control.**

Develop, document, and implement a configuration management plan for the system that:
- Addresses roles, responsibilities, and configuration management processes and procedures;
- Establishes a process for identifying configuration items throughout the system development life cycle and for managing the configuration of the configuration items;
- Defines the configuration items for the system and places the configuration items under configuration management;
- Is reviewed and approved by [CM-09_ODP] ; and
- Protects the configuration management plan from unauthorized disclosure and modification.

**Discussion.**

Configuration management activities occur throughout the system development life cycle. As such, there are developmental configuration management activities (e.g., the control of code and software libraries) and operational configuration management activities (e.g., control of installed components and how the components are configured). Configuration management plans satisfy the requirements in configuration management policies while being tailored to individual systems. Configuration management plans define processes and procedures for how configuration management is used to support system development life cycle activities.

Configuration management plans are generated during the development and acquisition stage of the system development life cycle. The plans describe how to advance changes through change management processes; update configuration settings and baselines; maintain component inventories; control development, test, and operational environments; and develop, release, and update key documents.

Organizations can employ templates to help ensure the consistent and timely development and implementation of configuration management plans. Templates can represent a configuration management plan for the organization with subsets of the plan implemented on a system by system basis. Configuration management approval processes include the designation of key stakeholders responsible for reviewing and approving proposed changes to systems, and personnel who conduct security and privacy impact analyses prior to the implementation of changes to the systems. Configuration items are the system components, such as the hardware, software, firmware, and documentation to be configuration-managed. As systems continue through the system development life cycle, new configuration items may be identified, and some existing configuration items may no longer need to be under configuration control.

### CM-9(1) Assignment of Responsibility <a id="cm-9.1"></a>

**Control.**

Assign responsibility for developing the configuration management process to organizational personnel that are not directly involved in system development.

**Discussion.**

In the absence of dedicated configuration management teams assigned within organizations, system developers may be tasked with developing configuration management processes using personnel who are not directly involved in system development or system integration. This separation of duties ensures that organizations establish and maintain a sufficient degree of independence between the system development and integration processes and configuration management processes to facilitate quality control and more effective oversight.

## CM-10 Software Usage Restrictions <a id="cm-10"></a>

**Control.**

- Use software and associated documentation in accordance with contract agreements and copyright laws;
- Track the use of software and associated documentation protected by quantity licenses to control copying and distribution; and
- Control and document the use of peer-to-peer file sharing technology to ensure that this capability is not used for the unauthorized distribution, display, performance, or reproduction of copyrighted work.

**Discussion.**

Software license tracking can be accomplished by manual or automated methods, depending on organizational needs. Examples of contract agreements include software license agreements and non-disclosure agreements.

### CM-10(1) Open-source Software <a id="cm-10.1"></a>

**Control.**

Establish the following restrictions on the use of open-source software: [CM-10(01)_ODP].

**Discussion.**

Open-source software refers to software that is available in source code form. Certain software rights normally reserved for copyright holders are routinely provided under software license agreements that permit individuals to study, change, and improve the software. From a security perspective, the major advantage of open-source software is that it provides organizations with the ability to examine the source code. In some cases, there is an online community associated with the software that inspects, tests, updates, and reports on issues found in software on an ongoing basis. However, remediating vulnerabilities in open-source software may be problematic. There may also be licensing issues associated with open-source software, including the constraints on derivative use of such software. Open-source software that is available only in binary form may increase the level of risk in using such software.

## CM-11 User-installed Software <a id="cm-11"></a>

**Control.**

- Establish [CM-11_ODP[01]] governing the installation of software by users;
- Enforce software installation policies through the following methods: [CM-11_ODP[02]] ; and
- Monitor policy compliance [CM-11_ODP[03]].

**Discussion.**

If provided the necessary privileges, users can install software in organizational systems. To maintain control over the software installed, organizations identify permitted and prohibited actions regarding software installation. Permitted software installations include updates and security patches to existing software and downloading new applications from organization-approved "app stores." Prohibited software installations include software with unknown or suspect pedigrees or software that organizations consider potentially malicious. Policies selected for governing user-installed software are organization-developed or provided by some external entity. Policy enforcement methods can include procedural methods and automated methods.

### CM-11(1) Alerts for Unauthorized Installations <a id="cm-11.1"></a>

### CM-11(2) Software Installation with Privileged Status <a id="cm-11.2"></a>

**Control.**

Allow user installation of software only with explicit privileged status.

**Discussion.**

Privileged status can be obtained, for example, by serving in the role of system administrator.

### CM-11(3) Automated Enforcement and Monitoring <a id="cm-11.3"></a>

**Control.**

Enforce and monitor compliance with software installation policies using [organization-defined automated mechanisms].

**Discussion.**

Organizations enforce and monitor compliance with software installation policies using automated mechanisms to more quickly detect and respond to unauthorized software installation which can be an indicator of an internal or external hostile attack.

## CM-12 Information Location <a id="cm-12"></a>

**Control.**

- Identify and document the location of [CM-12_ODP] and the specific system components on which the information is processed and stored;
- Identify and document the users who have access to the system and system components where the information is processed and stored; and
- Document changes to the location (i.e., system or system components) where the information is processed and stored.

**Discussion.**

Information location addresses the need to understand where information is being processed and stored. Information location includes identifying where specific information types and information reside in system components and how information is being processed so that information flow can be understood and adequate protection and policy management provided for such information and system components. The security category of the information is also a factor in determining the controls necessary to protect the information and the system component where the information resides (see [FIPS 199](#628d22a1-6a11-4784-bc59-5cd9497b5445) ). The location of the information and system components is also a factor in the architecture and design of the system (see [SA-4](#sa-4), [SA-8](#sa-8), [SA-17](#sa-17)).

### CM-12(1) Automated Tools to Support Information Location <a id="cm-12.1"></a>

**Control.**

Use automated tools to identify [CM-12(01)_ODP[01]] on [CM-12(01)_ODP[02]] to ensure controls are in place to protect organizational information and individual privacy.

**Discussion.**

The use of automated tools helps to increase the effectiveness and efficiency of the information location capability implemented within the system. Automation also helps organizations manage the data produced during information location activities and share such information across the organization. The output of automated information location tools can be used to guide and inform system architecture and design decisions.

## CM-13 Data Action Mapping <a id="cm-13"></a>

**Control.**

Develop and document a map of system data actions.

**Discussion.**

Data actions are system operations that process personally identifiable information. The processing of such information encompasses the full information life cycle, which includes collection, generation, transformation, use, disclosure, retention, and disposal. A map of system data actions includes discrete data actions, elements of personally identifiable information being processed in the data actions, system components involved in the data actions, and the owners or operators of the system components. Understanding what personally identifiable information is being processed (e.g., the sensitivity of the personally identifiable information), how personally identifiable information is being processed (e.g., if the data action is visible to the individual or is processed in another part of the system), and by whom (e.g., individuals may have different privacy perceptions based on the entity that is processing the personally identifiable information) provides a number of contextual factors that are important to assessing the degree of privacy risk created by the system. Data maps can be illustrated in different ways, and the level of detail may vary based on the mission and business needs of the organization. The data map may be an overlay of any system design artifact that the organization is using. The development of this map may necessitate coordination between the privacy and security programs regarding the covered data actions and the components that are identified as part of the system.

## CM-14 Signed Components <a id="cm-14"></a>

**Control.**

Prevent the installation of [organization-defined software and firmware components] without verification that the component has been digitally signed using a certificate that is recognized and approved by the organization.

**Discussion.**

Software and firmware components prevented from installation unless signed with recognized and approved certificates include software and firmware version updates, patches, service packs, device drivers, and basic input/output system updates. Organizations can identify applicable software and firmware components by type, by specific items, or a combination of both. Digital signatures and organizational verification of such signatures is a method of code authentication.
