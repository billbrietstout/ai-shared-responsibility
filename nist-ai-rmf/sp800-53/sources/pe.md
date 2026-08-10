# Physical and Environmental Protection <a id="pe"></a>

```
doc_id: sp800-53-rev5
nist_id: NIST.SP.800-53
version: 5.2.0
family: pe
doi: https://doi.org/10.6028/NIST.SP.800-53r5
disclaimer: Structured Markdown extract for demo retrieval. Not official NIST output.
```

## PE-1 Policy and Procedures <a id="pe-1"></a>

**Control.**

- Develop, document, and disseminate to [organization-defined personnel or roles]:
  - [PE-01_ODP[03]] physical and environmental protection policy that:
    - Addresses purpose, scope, roles, responsibilities, management commitment, coordination among organizational entities, and compliance; and
    - Is consistent with applicable laws, executive orders, directives, regulations, policies, standards, and guidelines; and
  - Procedures to facilitate the implementation of the physical and environmental protection policy and the associated physical and environmental protection controls;
- Designate an [PE-01_ODP[04]] to manage the development, documentation, and dissemination of the physical and environmental protection policy and procedures; and
- Review and update the current physical and environmental protection:
  - Policy [PE-01_ODP[05]] and following [PE-01_ODP[06]] ; and
  - Procedures [PE-01_ODP[07]] and following [PE-01_ODP[08]].

**Discussion.**

Physical and environmental protection policy and procedures address the controls in the PE family that are implemented within systems and organizations. The risk management strategy is an important factor in establishing such policies and procedures. Policies and procedures contribute to security and privacy assurance. Therefore, it is important that security and privacy programs collaborate on the development of physical and environmental protection policy and procedures. Security and privacy program policies and procedures at the organization level are preferable, in general, and may obviate the need for mission- or system-specific policies and procedures. The policy can be included as part of the general security and privacy policy or be represented by multiple policies that reflect the complex nature of organizations. Procedures can be established for security and privacy programs, for mission or business processes, and for systems, if needed. Procedures describe how the policies or controls are implemented and can be directed at the individual or role that is the object of the procedure. Procedures can be documented in system security and privacy plans or in one or more separate documents. Events that may precipitate an update to physical and environmental protection policy and procedures include assessment or audit findings, security incidents or breaches, or changes in applicable laws, executive orders, directives, regulations, policies, standards, and guidelines. Simply restating controls does not constitute an organizational policy or procedure.

## PE-2 Physical Access Authorizations <a id="pe-2"></a>

**Control.**

- Develop, approve, and maintain a list of individuals with authorized access to the facility where the system resides;
- Issue authorization credentials for facility access;
- Review the access list detailing authorized facility access by individuals [PE-02_ODP] ; and
- Remove individuals from the facility access list when access is no longer required.

**Discussion.**

Physical access authorizations apply to employees and visitors. Individuals with permanent physical access authorization credentials are not considered visitors. Authorization credentials include ID badges, identification cards, and smart cards. Organizations determine the strength of authorization credentials needed consistent with applicable laws, executive orders, directives, regulations, policies, standards, and guidelines. Physical access authorizations may not be necessary to access certain areas within facilities that are designated as publicly accessible.

### PE-2(1) Access by Position or Role <a id="pe-2.1"></a>

**Control.**

Authorize physical access to the facility where the system resides based on position or role.

**Discussion.**

Role-based facility access includes access by authorized permanent and regular/routine maintenance personnel, duty officers, and emergency medical staff.

### PE-2(2) Two Forms of Identification <a id="pe-2.2"></a>

**Control.**

Require two forms of identification from the following forms of identification for visitor access to the facility where the system resides: [PE-02(02)_ODP].

**Discussion.**

Acceptable forms of identification include passports, REAL ID-compliant drivers’ licenses, and Personal Identity Verification (PIV) cards. For gaining access to facilities using automated mechanisms, organizations may use PIV cards, key cards, PINs, and biometrics.

### PE-2(3) Restrict Unescorted Access <a id="pe-2.3"></a>

**Control.**

Restrict unescorted access to the facility where the system resides to personnel with [PE-02(03)_ODP[01]].

**Discussion.**

Individuals without required security clearances, access approvals, or need to know are escorted by individuals with appropriate physical access authorizations to ensure that information is not exposed or otherwise compromised.

## PE-3 Physical Access Control <a id="pe-3"></a>

**Control.**

- Enforce physical access authorizations at [PE-03_ODP[01]] by:
  - Verifying individual access authorizations before granting access to the facility; and
  - Controlling ingress and egress to the facility using [PE-03_ODP[02]];
- Maintain physical access audit logs for [PE-03_ODP[04]];
- Control access to areas within the facility designated as publicly accessible by implementing the following controls: [PE-03_ODP[05]];
- Escort visitors and control visitor activity [PE-03_ODP[06]];
- Secure keys, combinations, and other physical access devices;
- Inventory [PE-03_ODP[07]] every [PE-03_ODP[08]] ; and
- Change combinations and keys [organization-defined frequency] and/or when keys are lost, combinations are compromised, or when individuals possessing the keys or combinations are transferred or terminated.

**Discussion.**

Physical access control applies to employees and visitors. Individuals with permanent physical access authorizations are not considered visitors. Physical access controls for publicly accessible areas may include physical access control logs/records, guards, or physical access devices and barriers to prevent movement from publicly accessible areas to non-public areas. Organizations determine the types of guards needed, including professional security staff, system users, or administrative staff. Physical access devices include keys, locks, combinations, biometric readers, and card readers. Physical access control systems comply with applicable laws, executive orders, directives, policies, regulations, standards, and guidelines. Organizations have flexibility in the types of audit logs employed. Audit logs can be procedural, automated, or some combination thereof. Physical access points can include facility access points, interior access points to systems that require supplemental access controls, or both. Components of systems may be in areas designated as publicly accessible with organizations controlling access to the components.

### PE-3(1) System Access <a id="pe-3.1"></a>

**Control.**

Enforce physical access authorizations to the system in addition to the physical access controls for the facility at [PE-03(01)_ODP].

**Discussion.**

Control of physical access to the system provides additional physical security for those areas within facilities where there is a concentration of system components.

### PE-3(2) Facility and Systems <a id="pe-3.2"></a>

**Control.**

Perform security checks [PE-03(02)_ODP] at the physical perimeter of the facility or system for exfiltration of information or removal of system components.

**Discussion.**

Organizations determine the extent, frequency, and/or randomness of security checks to adequately mitigate risk associated with exfiltration.

### PE-3(3) Continuous Guards <a id="pe-3.3"></a>

**Control.**

Employ guards to control [PE-03(03)_ODP] to the facility where the system resides 24 hours per day, 7 days per week.

**Discussion.**

Employing guards at selected physical access points to the facility provides a more rapid response capability for organizations. Guards also provide the opportunity for human surveillance in areas of the facility not covered by video surveillance.

### PE-3(4) Lockable Casings <a id="pe-3.4"></a>

**Control.**

Use lockable physical casings to protect [PE-03(04)_ODP] from unauthorized physical access.

**Discussion.**

The greatest risk from the use of portable devices—such as smart phones, tablets, and notebook computers—is theft. Organizations can employ lockable, physical casings to reduce or eliminate the risk of equipment theft. Such casings come in a variety of sizes, from units that protect a single notebook computer to full cabinets that can protect multiple servers, computers, and peripherals. Lockable physical casings can be used in conjunction with cable locks or lockdown plates to prevent the theft of the locked casing containing the computer equipment.

### PE-3(5) Tamper Protection <a id="pe-3.5"></a>

**Control.**

Employ [PE-03(05)_ODP[01]] to [PE-03(05)_ODP[02]] physical tampering or alteration of [PE-03(05)_ODP[03]] within the system.

**Discussion.**

Organizations can implement tamper detection and prevention at selected hardware components or implement tamper detection at some components and tamper prevention at other components. Detection and prevention activities can employ many types of anti-tamper technologies, including tamper-detection seals and anti-tamper coatings. Anti-tamper programs help to detect hardware alterations through counterfeiting and other supply chain-related risks.

### PE-3(6) Facility Penetration Testing <a id="pe-3.6"></a>

### PE-3(7) Physical Barriers <a id="pe-3.7"></a>

**Control.**

Limit access using physical barriers.

**Discussion.**

Physical barriers include bollards, concrete slabs, jersey walls, and hydraulic active vehicle barriers.

### PE-3(8) Access Control Vestibules <a id="pe-3.8"></a>

**Control.**

Employ access control vestibules at [PE-03(08)_ODP].

**Discussion.**

An access control vestibule is part of a physical access control system that typically provides a space between two sets of interlocking doors. Vestibules are designed to prevent unauthorized individuals from following authorized individuals into facilities with controlled access. This activity, also known as piggybacking or tailgating, results in unauthorized access to the facility. Interlocking door controllers can be used to limit the number of individuals who enter controlled access points and to provide containment areas while authorization for physical access is verified. Interlocking door controllers can be fully automated (i.e., controlling the opening and closing of the doors) or partially automated (i.e., using security guards to control the number of individuals entering the containment area).

## PE-4 Access Control for Transmission <a id="pe-4"></a>

**Control.**

Control physical access to [PE-04_ODP[01]] within organizational facilities using [PE-04_ODP[02]].

**Discussion.**

Security controls applied to system distribution and transmission lines prevent accidental damage, disruption, and physical tampering. Such controls may also be necessary to prevent eavesdropping or modification of unencrypted transmissions. Security controls used to control physical access to system distribution and transmission lines include disconnected or locked spare jacks, locked wiring closets, protection of cabling by conduit or cable trays, and wiretapping sensors.

## PE-5 Access Control for Output Devices <a id="pe-5"></a>

**Control.**

Control physical access to output from [PE-05_ODP] to prevent unauthorized individuals from obtaining the output.

**Discussion.**

Controlling physical access to output devices includes placing output devices in locked rooms or other secured areas with keypad or card reader access controls and allowing access to authorized individuals only, placing output devices in locations that can be monitored by personnel, installing monitor or screen filters, and using headphones. Examples of output devices include monitors, printers, scanners, audio devices, facsimile machines, and copiers.

### PE-5(1) Access to Output by Authorized Individuals <a id="pe-5.1"></a>

### PE-5(2) Link to Individual Identity <a id="pe-5.2"></a>

**Control.**

Link individual identity to receipt of output from output devices.

**Discussion.**

Methods for linking individual identity to the receipt of output from output devices include installing security functionality on facsimile machines, copiers, and printers. Such functionality allows organizations to implement authentication on output devices prior to the release of output to individuals.

### PE-5(3) Marking Output Devices <a id="pe-5.3"></a>

## PE-6 Monitoring Physical Access <a id="pe-6"></a>

**Control.**

- Monitor physical access to the facility where the system resides to detect and respond to physical security incidents;
- Review physical access logs [PE-06_ODP[01]] and upon occurrence of [PE-06_ODP[02]] ; and
- Coordinate results of reviews and investigations with the organizational incident response capability.

**Discussion.**

Physical access monitoring includes publicly accessible areas within organizational facilities. Examples of physical access monitoring include the employment of guards, video surveillance equipment (i.e., cameras), and sensor devices. Reviewing physical access logs can help identify suspicious activity, anomalous events, or potential threats. The reviews can be supported by audit logging controls, such as [AU-2](#au-2) , if the access logs are part of an automated system. Organizational incident response capabilities include investigations of physical security incidents and responses to the incidents. Incidents include security violations or suspicious physical access activities. Suspicious physical access activities include accesses outside of normal work hours, repeated accesses to areas not normally accessed, accesses for unusual lengths of time, and out-of-sequence accesses.

### PE-6(1) Intrusion Alarms and Surveillance Equipment <a id="pe-6.1"></a>

**Control.**

Monitor physical access to the facility where the system resides using physical intrusion alarms and surveillance equipment.

**Discussion.**

Physical intrusion alarms can be employed to alert security personnel when unauthorized access to the facility is attempted. Alarm systems work in conjunction with physical barriers, physical access control systems, and security guards by triggering a response when these other forms of security have been compromised or breached. Physical intrusion alarms can include different types of sensor devices, such as motion sensors, contact sensors, and broken glass sensors. Surveillance equipment includes video cameras installed at strategic locations throughout the facility.

### PE-6(2) Automated Intrusion Recognition and Responses <a id="pe-6.2"></a>

**Control.**

Recognize [PE-06(02)_ODP[01]] and initiate [PE-06(02)_ODP[02]] using [PE-06(02)_ODP[03]].

**Discussion.**

Response actions can include notifying selected organizational personnel or law enforcement personnel. Automated mechanisms implemented to initiate response actions include system alert notifications, email and text messages, and activating door locking mechanisms. Physical access monitoring can be coordinated with intrusion detection systems and system monitoring capabilities to provide integrated threat coverage for the organization.

### PE-6(3) Video Surveillance <a id="pe-6.3"></a>

**Control.**

- Employ video surveillance of [PE-06(03)_ODP[01]];
- Review video recordings [PE-06(03)_ODP[02]] ; and
- Retain video recordings for [PE-06(03)_ODP[03]].

**Discussion.**

Video surveillance focuses on recording activity in specified areas for the purposes of subsequent review, if circumstances so warrant. Video recordings are typically reviewed to detect anomalous events or incidents. Monitoring the surveillance video is not required, although organizations may choose to do so. There may be legal considerations when performing and retaining video surveillance, especially if such surveillance is in a public location.

### PE-6(4) Monitoring Physical Access to Systems <a id="pe-6.4"></a>

**Control.**

Monitor physical access to the system in addition to the physical access monitoring of the facility at [PE-06(04)_ODP].

**Discussion.**

Monitoring physical access to systems provides additional monitoring for those areas within facilities where there is a concentration of system components, including server rooms, media storage areas, and communications centers. Physical access monitoring can be coordinated with intrusion detection systems and system monitoring capabilities to provide comprehensive and integrated threat coverage for the organization.

## PE-7 Visitor Control <a id="pe-7"></a>

## PE-8 Visitor Access Records <a id="pe-8"></a>

**Control.**

- Maintain visitor access records to the facility where the system resides for [PE-08_ODP[01]];
- Review visitor access records [PE-08_ODP[02]] ; and
- Report anomalies in visitor access records to [PE-08_ODP[03]].

**Discussion.**

Visitor access records include the names and organizations of individuals visiting, visitor signatures, forms of identification, dates of access, entry and departure times, purpose of visits, and the names and organizations of individuals visited. Access record reviews determine if access authorizations are current and are still required to support organizational mission and business functions. Access records are not required for publicly accessible areas.

### PE-8(1) Automated Records Maintenance and Review <a id="pe-8.1"></a>

**Control.**

Maintain and review visitor access records using [organization-defined automated mechanisms].

**Discussion.**

Visitor access records may be stored and maintained in a database management system that is accessible by organizational personnel. Automated access to such records facilitates record reviews on a regular basis to determine if access authorizations are current and still required to support organizational mission and business functions.

### PE-8(2) Physical Access Records <a id="pe-8.2"></a>

### PE-8(3) Limit Personally Identifiable Information Elements <a id="pe-8.3"></a>

**Control.**

Limit personally identifiable information contained in visitor access records to the following elements identified in the privacy risk assessment: [PE-08(03)_ODP].

**Discussion.**

Organizations may have requirements that specify the contents of visitor access records. Limiting personally identifiable information in visitor access records when such information is not needed for operational purposes helps reduce the level of privacy risk created by a system.

## PE-9 Power Equipment and Cabling <a id="pe-9"></a>

**Control.**

Protect power equipment and power cabling for the system from damage and destruction.

**Discussion.**

Organizations determine the types of protection necessary for the power equipment and cabling employed at different locations that are both internal and external to organizational facilities and environments of operation. Types of power equipment and cabling include internal cabling and uninterruptable power sources in offices or data centers, generators and power cabling outside of buildings, and power sources for self-contained components such as satellites, vehicles, and other deployable systems.

### PE-9(1) Redundant Cabling <a id="pe-9.1"></a>

**Control.**

Employ redundant power cabling paths that are physically separated by [PE-09(01)_ODP].

**Discussion.**

Physically separate and redundant power cables ensure that power continues to flow in the event that one of the cables is cut or otherwise damaged.

### PE-9(2) Automatic Voltage Controls <a id="pe-9.2"></a>

**Control.**

Employ automatic voltage controls for [PE-09(02)_ODP].

**Discussion.**

Automatic voltage controls can monitor and control voltage. Such controls include voltage regulators, voltage conditioners, and voltage stabilizers.

## PE-10 Emergency Shutoff <a id="pe-10"></a>

**Control.**

- Provide the capability of shutting off power to [PE-10_ODP[01]] in emergency situations;
- Place emergency shutoff switches or devices in [PE-10_ODP[02]] to facilitate access for authorized personnel; and
- Protect emergency power shutoff capability from unauthorized activation.

**Discussion.**

Emergency power shutoff primarily applies to organizational facilities that contain concentrations of system resources, including data centers, mainframe computer rooms, server rooms, and areas with computer-controlled machinery.

### PE-10(1) Accidental and Unauthorized Activation <a id="pe-10.1"></a>

## PE-11 Emergency Power <a id="pe-11"></a>

**Control.**

Provide an uninterruptible power supply to facilitate [PE-11_ODP] in the event of a primary power source loss.

**Discussion.**

An uninterruptible power supply (UPS) is an electrical system or mechanism that provides emergency power when there is a failure of the main power source. A UPS is typically used to protect computers, data centers, telecommunication equipment, or other electrical equipment where an unexpected power disruption could cause injuries, fatalities, serious mission or business disruption, or loss of data or information. A UPS differs from an emergency power system or backup generator in that the UPS provides near-instantaneous protection from unanticipated power interruptions from the main power source by providing energy stored in batteries, supercapacitors, or flywheels. The battery duration of a UPS is relatively short but provides sufficient time to start a standby power source, such as a backup generator, or properly shut down the system.

### PE-11(1) Alternate Power Supply — Minimal Operational Capability <a id="pe-11.1"></a>

**Control.**

Provide an alternate power supply for the system that is activated [PE-11(01)_ODP] and that can maintain minimally required operational capability in the event of an extended loss of the primary power source.

**Discussion.**

Provision of an alternate power supply with minimal operating capability can be satisfied by accessing a secondary commercial power supply or other external power supply.

### PE-11(2) Alternate Power Supply — Self-contained <a id="pe-11.2"></a>

**Control.**

Provide an alternate power supply for the system that is activated [PE-11(02)_ODP[01]] and that is:
- Self-contained;
- Not reliant on external power generation; and
- Capable of maintaining [PE-11(02)_ODP[02]] in the event of an extended loss of the primary power source.

**Discussion.**

The provision of a long-term, self-contained power supply can be satisfied by using one or more generators with sufficient capacity to meet the needs of the organization.

## PE-12 Emergency Lighting <a id="pe-12"></a>

**Control.**

Employ and maintain automatic emergency lighting for the system that activates in the event of a power outage or disruption and that covers emergency exits and evacuation routes within the facility.

**Discussion.**

The provision of emergency lighting applies primarily to organizational facilities that contain concentrations of system resources, including data centers, server rooms, and mainframe computer rooms. Emergency lighting provisions for the system are described in the contingency plan for the organization. If emergency lighting for the system fails or cannot be provided, organizations consider alternate processing sites for power-related contingencies.

### PE-12(1) Essential Mission and Business Functions <a id="pe-12.1"></a>

**Control.**

Provide emergency lighting for all areas within the facility supporting essential mission and business functions.

**Discussion.**

Organizations define their essential missions and functions.

## PE-13 Fire Protection <a id="pe-13"></a>

**Control.**

Employ and maintain fire detection and suppression systems that are supported by an independent energy source.

**Discussion.**

The provision of fire detection and suppression systems applies primarily to organizational facilities that contain concentrations of system resources, including data centers, server rooms, and mainframe computer rooms. Fire detection and suppression systems that may require an independent energy source include sprinkler systems and smoke detectors. An independent energy source is an energy source, such as a microgrid, that is separate, or can be separated, from the energy sources providing power for the other parts of the facility.

### PE-13(1) Detection Systems — Automatic Activation and Notification <a id="pe-13.1"></a>

**Control.**

Employ fire detection systems that activate automatically and notify [PE-13(01)_ODP[01]] and [PE-13(01)_ODP[02]] in the event of a fire.

**Discussion.**

Organizations can identify personnel, roles, and emergency responders if individuals on the notification list need to have access authorizations or clearances (e.g., to enter to facilities where access is restricted due to the classification or impact level of information within the facility). Notification mechanisms may require independent energy sources to ensure that the notification capability is not adversely affected by the fire.

### PE-13(2) Suppression Systems — Automatic Activation and Notification <a id="pe-13.2"></a>

**Control.**

- Employ fire suppression systems that activate automatically and notify [PE-13(02)_ODP[01]] and [PE-13(02)_ODP[02]] ; and
- Employ an automatic fire suppression capability when the facility is not staffed on a continuous basis.

**Discussion.**

Organizations can identify specific personnel, roles, and emergency responders if individuals on the notification list need to have appropriate access authorizations and/or clearances (e.g., to enter to facilities where access is restricted due to the impact level or classification of information within the facility). Notification mechanisms may require independent energy sources to ensure that the notification capability is not adversely affected by the fire.

### PE-13(3) Automatic Fire Suppression <a id="pe-13.3"></a>

### PE-13(4) Inspections <a id="pe-13.4"></a>

**Control.**

Ensure that the facility undergoes [PE-13(04)_ODP[01]] fire protection inspections by authorized and qualified inspectors and identified deficiencies are resolved within [PE-13(04)_ODP[02]].

**Discussion.**

Authorized and qualified personnel within the jurisdiction of the organization include state, county, and city fire inspectors and fire marshals. Organizations provide escorts during inspections in situations where the systems that reside within the facilities contain sensitive information.

## PE-14 Environmental Controls <a id="pe-14"></a>

**Control.**

- Maintain [PE-14_ODP[01]] levels within the facility where the system resides at [PE-14_ODP[03]] ; and
- Monitor environmental control levels [PE-14_ODP[04]].

**Discussion.**

The provision of environmental controls applies primarily to organizational facilities that contain concentrations of system resources (e.g., data centers, mainframe computer rooms, and server rooms). Insufficient environmental controls, especially in very harsh environments, can have a significant adverse impact on the availability of systems and system components that are needed to support organizational mission and business functions.

### PE-14(1) Automatic Controls <a id="pe-14.1"></a>

**Control.**

Employ the following automatic environmental controls in the facility to prevent fluctuations potentially harmful to the system: [PE-14(01)_ODP].

**Discussion.**

The implementation of automatic environmental controls provides an immediate response to environmental conditions that can damage, degrade, or destroy organizational systems or systems components.

### PE-14(2) Monitoring with Alarms and Notifications <a id="pe-14.2"></a>

**Control.**

Employ environmental control monitoring that provides an alarm or notification of changes potentially harmful to personnel or equipment to [PE-14(02)_ODP].

**Discussion.**

The alarm or notification may be an audible alarm or a visual message in real time to personnel or roles defined by the organization. Such alarms and notifications can help minimize harm to individuals and damage to organizational assets by facilitating a timely incident response.

## PE-15 Water Damage Protection <a id="pe-15"></a>

**Control.**

Protect the system from damage resulting from water leakage by providing master shutoff or isolation valves that are accessible, working properly, and known to key personnel.

**Discussion.**

The provision of water damage protection primarily applies to organizational facilities that contain concentrations of system resources, including data centers, server rooms, and mainframe computer rooms. Isolation valves can be employed in addition to or in lieu of master shutoff valves to shut off water supplies in specific areas of concern without affecting entire organizations.

### PE-15(1) Automation Support <a id="pe-15.1"></a>

**Control.**

Detect the presence of water near the system and alert [PE-15(01)_ODP[01]] using [PE-15(01)_ODP[02]].

**Discussion.**

Automated mechanisms include notification systems, water detection sensors, and alarms.

## PE-16 Delivery and Removal <a id="pe-16"></a>

**Control.**

- Authorize and control [organization-defined types of system components] entering and exiting the facility; and
- Maintain records of the system components.

**Discussion.**

Enforcing authorizations for entry and exit of system components may require restricting access to delivery areas and isolating the areas from the system and media libraries.

## PE-17 Alternate Work Site <a id="pe-17"></a>

**Control.**

- Determine and document the [PE-17_ODP[01]] allowed for use by employees;
- Employ the following controls at alternate work sites: [PE-17_ODP[02]];
- Assess the effectiveness of controls at alternate work sites; and
- Provide a means for employees to communicate with information security and privacy personnel in case of incidents.

**Discussion.**

Alternate work sites include government facilities or the private residences of employees. While distinct from alternative processing sites, alternate work sites can provide readily available alternate locations during contingency operations. Organizations can define different sets of controls for specific alternate work sites or types of sites depending on the work-related activities conducted at the sites. Implementing and assessing the effectiveness of organization-defined controls and providing a means to communicate incidents at alternate work sites supports the contingency planning activities of organizations.

## PE-18 Location of System Components <a id="pe-18"></a>

**Control.**

Position system components within the facility to minimize potential damage from [PE-18_ODP] and to minimize the opportunity for unauthorized access.

**Discussion.**

Physical and environmental hazards include floods, fires, tornadoes, earthquakes, hurricanes, terrorism, vandalism, an electromagnetic pulse, electrical interference, and other forms of incoming electromagnetic radiation. Organizations consider the location of entry points where unauthorized individuals, while not being granted access, might nonetheless be near systems. Such proximity can increase the risk of unauthorized access to organizational communications using wireless packet sniffers or microphones, or unauthorized disclosure of information.

### PE-18(1) Facility Site <a id="pe-18.1"></a>

## PE-19 Information Leakage <a id="pe-19"></a>

**Control.**

Protect the system from information leakage due to electromagnetic signals emanations.

**Discussion.**

Information leakage is the intentional or unintentional release of data or information to an untrusted environment from electromagnetic signals emanations. The security categories or classifications of systems (with respect to confidentiality), organizational security policies, and risk tolerance guide the selection of controls employed to protect systems against information leakage due to electromagnetic signals emanations.

### PE-19(1) National Emissions Policies and Procedures <a id="pe-19.1"></a>

**Control.**

Protect system components, associated data communications, and networks in accordance with national Emissions Security policies and procedures based on the security category or classification of the information.

**Discussion.**

Emissions Security (EMSEC) policies include the former TEMPEST policies.

## PE-20 Asset Monitoring and Tracking <a id="pe-20"></a>

**Control.**

Employ [PE-20_ODP[01]] to track and monitor the location and movement of [PE-20_ODP[02]] within [PE-20_ODP[03]].

**Discussion.**

Asset location technologies can help ensure that critical assets—including vehicles, equipment, and system components—remain in authorized locations. Organizations consult with the Office of the General Counsel and senior agency official for privacy regarding the deployment and use of asset location technologies to address potential privacy concerns.

## PE-21 Electromagnetic Pulse Protection <a id="pe-21"></a>

**Control.**

Employ [PE-21_ODP[01]] against electromagnetic pulse damage for [PE-21_ODP[02]].

**Discussion.**

An electromagnetic pulse (EMP) is a short burst of electromagnetic energy that is spread over a range of frequencies. Such energy bursts may be natural or man-made. EMP interference may be disruptive or damaging to electronic equipment. Protective measures used to mitigate EMP risk include shielding, surge suppressors, ferro-resonant transformers, and earth grounding. EMP protection may be especially significant for systems and applications that are part of the U.S. critical infrastructure.

## PE-22 Component Marking <a id="pe-22"></a>

**Control.**

Mark [PE-22_ODP] indicating the impact level or classification level of the information permitted to be processed, stored, or transmitted by the hardware component.

**Discussion.**

Hardware components that may require marking include input and output devices. Input devices include desktop and notebook computers, keyboards, tablets, and smart phones. Output devices include printers, monitors/video displays, facsimile machines, scanners, copiers, and audio devices. Permissions controlling output to the output devices are addressed in [AC-3](#ac-3) or [AC-4](#ac-4) . Components are marked to indicate the impact level or classification level of the system to which the devices are connected, or the impact level or classification level of the information permitted to be output. Security marking refers to the use of human-readable security attributes. Security labeling refers to the use of security attributes for internal system data structures. Security marking is generally not required for hardware components that process, store, or transmit information determined by organizations to be in the public domain or to be publicly releasable. However, organizations may require markings for hardware components that process, store, or transmit public information in order to indicate that such information is publicly releasable. Marking of system hardware components reflects applicable laws, executive orders, directives, policies, regulations, and standards.

## PE-23 Facility Location <a id="pe-23"></a>

**Control.**

- Plan the location or site of the facility where the system resides considering physical and environmental hazards; and
- For existing facilities, consider the physical and environmental hazards in the organizational risk management strategy.

**Discussion.**

Physical and environmental hazards include floods, fires, tornadoes, earthquakes, hurricanes, terrorism, vandalism, an electromagnetic pulse, electrical interference, and other forms of incoming electromagnetic radiation. The location of system components within the facility is addressed in [PE-18](#pe-18).
