# Media Protection <a id="mp"></a>

```
doc_id: sp800-53-rev5
nist_id: NIST.SP.800-53
version: 5.2.0
family: mp
doi: https://doi.org/10.6028/NIST.SP.800-53r5
disclaimer: Structured Markdown extract for demo retrieval. Not official NIST output.
```

## MP-1 Policy and Procedures <a id="mp-1"></a>

**Control.**

- Develop, document, and disseminate to [organization-defined personnel or roles]:
  - [MP-01_ODP[03]] media protection policy that:
    - Addresses purpose, scope, roles, responsibilities, management commitment, coordination among organizational entities, and compliance; and
    - Is consistent with applicable laws, executive orders, directives, regulations, policies, standards, and guidelines; and
  - Procedures to facilitate the implementation of the media protection policy and the associated media protection controls;
- Designate an [MP-01_ODP[04]] to manage the development, documentation, and dissemination of the media protection policy and procedures; and
- Review and update the current media protection:
  - Policy [MP-01_ODP[05]] and following [MP-01_ODP[06]] ; and
  - Procedures [MP-01_ODP[07]] and following [MP-01_ODP[08]].

**Discussion.**

Media protection policy and procedures address the controls in the MP family that are implemented within systems and organizations. The risk management strategy is an important factor in establishing such policies and procedures. Policies and procedures contribute to security and privacy assurance. Therefore, it is important that security and privacy programs collaborate on the development of media protection policy and procedures. Security and privacy program policies and procedures at the organization level are preferable, in general, and may obviate the need for mission- or system-specific policies and procedures. The policy can be included as part of the general security and privacy policy or be represented by multiple policies that reflect the complex nature of organizations. Procedures can be established for security and privacy programs, for mission or business processes, and for systems, if needed. Procedures describe how the policies or controls are implemented and can be directed at the individual or role that is the object of the procedure. Procedures can be documented in system security and privacy plans or in one or more separate documents. Events that may precipitate an update to media protection policy and procedures include assessment or audit findings, security incidents or breaches, or changes in applicable laws, executive orders, directives, regulations, policies, standards, and guidelines. Simply restating controls does not constitute an organizational policy or procedure.

## MP-2 Media Access <a id="mp-2"></a>

**Control.**

Restrict access to [organization-defined types of digital and/or non-digital media] to [organization-defined personnel or roles].

**Discussion.**

System media includes digital and non-digital media. Digital media includes flash drives, diskettes, magnetic tapes, external or removable hard disk drives (e.g., solid state, magnetic), compact discs, and digital versatile discs. Non-digital media includes paper and microfilm. Denying access to patient medical records in a community hospital unless the individuals seeking access to such records are authorized healthcare providers is an example of restricting access to non-digital media. Limiting access to the design specifications stored on compact discs in the media library to individuals on the system development team is an example of restricting access to digital media.

### MP-2(1) Automated Restricted Access <a id="mp-2.1"></a>

### MP-2(2) Cryptographic Protection <a id="mp-2.2"></a>

## MP-3 Media Marking <a id="mp-3"></a>

**Control.**

- Mark system media indicating the distribution limitations, handling caveats, and applicable security markings (if any) of the information; and
- Exempt [MP-03_ODP[01]] from marking if the media remain within [MP-03_ODP[02]].

**Discussion.**

Security marking refers to the application or use of human-readable security attributes. Digital media includes diskettes, magnetic tapes, external or removable hard disk drives (e.g., solid state, magnetic), flash drives, compact discs, and digital versatile discs. Non-digital media includes paper and microfilm. Controlled unclassified information is defined by the National Archives and Records Administration along with the appropriate safeguarding and dissemination requirements for such information and is codified in [32 CFR 2002](#91f992fb-f668-4c91-a50f-0f05b95ccee3) . Security markings are generally not required for media that contains information determined by organizations to be in the public domain or to be publicly releasable. Some organizations may require markings for public information indicating that the information is publicly releasable. System media marking reflects applicable laws, executive orders, directives, policies, regulations, standards, and guidelines.

## MP-4 Media Storage <a id="mp-4"></a>

**Control.**

- Physically control and securely store [organization-defined types of digital and/or non-digital media] within [organization-defined controlled areas] ; and
- Protect system media types defined in MP-4a until the media are destroyed or sanitized using approved equipment, techniques, and procedures.

**Discussion.**

System media includes digital and non-digital media. Digital media includes flash drives, diskettes, magnetic tapes, external or removable hard disk drives (e.g., solid state, magnetic), compact discs, and digital versatile discs. Non-digital media includes paper and microfilm. Physically controlling stored media includes conducting inventories, ensuring procedures are in place to allow individuals to check out and return media to the library, and maintaining accountability for stored media. Secure storage includes a locked drawer, desk, or cabinet or a controlled media library. The type of media storage is commensurate with the security category or classification of the information on the media. Controlled areas are spaces that provide physical and procedural controls to meet the requirements established for protecting information and systems. Fewer controls may be needed for media that contains information determined to be in the public domain, publicly releasable, or have limited adverse impacts on organizations, operations, or individuals if accessed by other than authorized personnel. In these situations, physical access controls provide adequate protection.

### MP-4(1) Cryptographic Protection <a id="mp-4.1"></a>

### MP-4(2) Automated Restricted Access <a id="mp-4.2"></a>

**Control.**

Restrict access to media storage areas and log access attempts and access granted using [organization-defined automated mechanisms].

**Discussion.**

Automated mechanisms include keypads, biometric readers, or card readers on the external entries to media storage areas.

## MP-5 Media Transport <a id="mp-5"></a>

**Control.**

- Protect and control [MP-05_ODP[01]] during transport outside of controlled areas using [organization-defined controls];
- Maintain accountability for system media during transport outside of controlled areas;
- Document activities associated with the transport of system media; and
- Restrict the activities associated with the transport of system media to authorized personnel.

**Discussion.**

System media includes digital and non-digital media. Digital media includes flash drives, diskettes, magnetic tapes, external or removable hard disk drives (e.g., solid state and magnetic), compact discs, and digital versatile discs. Non-digital media includes microfilm and paper. Controlled areas are spaces for which organizations provide physical or procedural controls to meet requirements established for protecting information and systems. Controls to protect media during transport include cryptography and locked containers. Cryptographic mechanisms can provide confidentiality and integrity protections depending on the mechanisms implemented. Activities associated with media transport include releasing media for transport, ensuring that media enters the appropriate transport processes, and the actual transport. Authorized transport and courier personnel may include individuals external to the organization. Maintaining accountability of media during transport includes restricting transport activities to authorized personnel and tracking and/or obtaining records of transport activities as the media moves through the transportation system to prevent and detect loss, destruction, or tampering. Organizations establish documentation requirements for activities associated with the transport of system media in accordance with organizational assessments of risk. Organizations maintain the flexibility to define record-keeping methods for the different types of media transport as part of a system of transport-related records.

### MP-5(1) Protection Outside of Controlled Areas <a id="mp-5.1"></a>

### MP-5(2) Documentation of Activities <a id="mp-5.2"></a>

### MP-5(3) Custodians <a id="mp-5.3"></a>

**Control.**

Employ an identified custodian during transport of system media outside of controlled areas.

**Discussion.**

Identified custodians provide organizations with specific points of contact during the media transport process and facilitate individual accountability. Custodial responsibilities can be transferred from one individual to another if an unambiguous custodian is identified.

### MP-5(4) Cryptographic Protection <a id="mp-5.4"></a>

## MP-6 Media Sanitization <a id="mp-6"></a>

**Control.**

- Sanitize [organization-defined system media] prior to disposal, release out of organizational control, or release for reuse using [organization-defined sanitization techniques and procedures] ; and
- Employ sanitization mechanisms with the strength and integrity commensurate with the security category or classification of the information.

**Discussion.**

Media sanitization applies to all digital and non-digital system media subject to disposal or reuse, whether or not the media is considered removable. Examples include digital media in scanners, copiers, printers, notebook computers, workstations, network components, mobile devices, and non-digital media (e.g., paper and microfilm). The sanitization process removes information from system media such that the information cannot be retrieved or reconstructed. Sanitization techniques—including clearing, purging, cryptographic erase, de-identification of personally identifiable information, and destruction—prevent the disclosure of information to unauthorized individuals when such media is reused or released for disposal. Organizations determine the appropriate sanitization methods, recognizing that destruction is sometimes necessary when other methods cannot be applied to media requiring sanitization. Organizations use discretion on the employment of approved sanitization techniques and procedures for media that contains information deemed to be in the public domain or publicly releasable or information deemed to have no adverse impact on organizations or individuals if released for reuse or disposal. Sanitization of non-digital media includes destruction, removing a classified appendix from an otherwise unclassified document, or redacting selected sections or words from a document by obscuring the redacted sections or words in a manner equivalent in effectiveness to removing them from the document. NSA standards and policies control the sanitization process for media that contains classified information. NARA policies control the sanitization process for controlled unclassified information.

### MP-6(1) Review, Approve, Track, Document, and Verify <a id="mp-6.1"></a>

**Control.**

Review, approve, track, document, and verify media sanitization and disposal actions.

**Discussion.**

Organizations review and approve media to be sanitized to ensure compliance with records retention policies. Tracking and documenting actions include listing personnel who reviewed and approved sanitization and disposal actions, types of media sanitized, files stored on the media, sanitization methods used, date and time of the sanitization actions, personnel who performed the sanitization, verification actions taken and personnel who performed the verification, and the disposal actions taken. Organizations verify that the sanitization of the media was effective prior to disposal.

### MP-6(2) Equipment Testing <a id="mp-6.2"></a>

**Control.**

Test sanitization equipment and procedures [organization-defined frequency] to ensure that the intended sanitization is being achieved.

**Discussion.**

Testing of sanitization equipment and procedures may be conducted by qualified and authorized external entities, including federal agencies or external service providers.

### MP-6(3) Nondestructive Techniques <a id="mp-6.3"></a>

**Control.**

Apply nondestructive sanitization techniques to portable storage devices prior to connecting such devices to the system under the following circumstances: [MP-06(03)_ODP].

**Discussion.**

Portable storage devices include external or removable hard disk drives (e.g., solid state, magnetic), optical discs, magnetic or optical tapes, flash memory devices, flash memory cards, and other external or removable disks. Portable storage devices can be obtained from untrustworthy sources and contain malicious code that can be inserted into or transferred to organizational systems through USB ports or other entry portals. While scanning storage devices is recommended, sanitization provides additional assurance that such devices are free of malicious code. Organizations consider nondestructive sanitization of portable storage devices when the devices are purchased from manufacturers or vendors prior to initial use or when organizations cannot maintain a positive chain of custody for the devices.

### MP-6(4) Controlled Unclassified Information <a id="mp-6.4"></a>

### MP-6(5) Classified Information <a id="mp-6.5"></a>

### MP-6(6) Media Destruction <a id="mp-6.6"></a>

### MP-6(7) Dual Authorization <a id="mp-6.7"></a>

**Control.**

Enforce dual authorization for the sanitization of [MP-06(07)_ODP].

**Discussion.**

Organizations employ dual authorization to help ensure that system media sanitization cannot occur unless two technically qualified individuals conduct the designated task. Individuals who sanitize system media possess sufficient skills and expertise to determine if the proposed sanitization reflects applicable federal and organizational standards, policies, and procedures. Dual authorization also helps to ensure that sanitization occurs as intended, protecting against errors and false claims of having performed the sanitization actions. Dual authorization may also be known as two-person control. To reduce the risk of collusion, organizations consider rotating dual authorization duties to other individuals.

### MP-6(8) Remote Purging or Wiping of Information <a id="mp-6.8"></a>

**Control.**

Provide the capability to purge or wipe information from [MP-06(08)_ODP[01]] [MP-06(08)_ODP[02]].

**Discussion.**

Remote purging or wiping of information protects information on organizational systems and system components if systems or components are obtained by unauthorized individuals. Remote purge or wipe commands require strong authentication to help mitigate the risk of unauthorized individuals purging or wiping the system, component, or device. The purge or wipe function can be implemented in a variety of ways, including by overwriting data or information multiple times or by destroying the key necessary to decrypt encrypted data.

## MP-7 Media Use <a id="mp-7"></a>

**Control.**

- [MP-07_ODP[02]] the use of [MP-07_ODP[01]] on [MP-07_ODP[03]] using [MP-07_ODP[04]] ; and
- Prohibit the use of portable storage devices in organizational systems when such devices have no identifiable owner.

**Discussion.**

System media includes both digital and non-digital media. Digital media includes diskettes, magnetic tapes, flash drives, compact discs, digital versatile discs, and removable hard disk drives. Non-digital media includes paper and microfilm. Media use protections also apply to mobile devices with information storage capabilities. In contrast to [MP-2](#mp-2) , which restricts user access to media, MP-7 restricts the use of certain types of media on systems, for example, restricting or prohibiting the use of flash drives or external hard disk drives. Organizations use technical and nontechnical controls to restrict the use of system media. Organizations may restrict the use of portable storage devices, for example, by using physical cages on workstations to prohibit access to certain external ports or disabling or removing the ability to insert, read, or write to such devices. Organizations may also limit the use of portable storage devices to only approved devices, including devices provided by the organization, devices provided by other approved organizations, and devices that are not personally owned. Finally, organizations may restrict the use of portable storage devices based on the type of device, such as by prohibiting the use of writeable, portable storage devices and implementing this restriction by disabling or removing the capability to write to such devices. Requiring identifiable owners for storage devices reduces the risk of using such devices by allowing organizations to assign responsibility for addressing known vulnerabilities in the devices.

### MP-7(1) Prohibit Use Without Owner <a id="mp-7.1"></a>

### MP-7(2) Prohibit Use of Sanitization-resistant Media <a id="mp-7.2"></a>

**Control.**

Prohibit the use of sanitization-resistant media in organizational systems.

**Discussion.**

Sanitization resistance refers to how resistant media are to non-destructive sanitization techniques with respect to the capability to purge information from media. Certain types of media do not support sanitization commands, or if supported, the interfaces are not supported in a standardized way across these devices. Sanitization-resistant media includes compact flash, embedded flash on boards and devices, solid state drives, and USB removable media.

## MP-8 Media Downgrading <a id="mp-8"></a>

**Control.**

- Establish [MP-08_ODP[01]] that includes employing downgrading mechanisms with strength and integrity commensurate with the security category or classification of the information;
- Verify that the system media downgrading process is commensurate with the security category and/or classification level of the information to be removed and the access authorizations of the potential recipients of the downgraded information;
- Identify [MP-08_ODP[02]] ; and
- Downgrade the identified system media using the established process.

**Discussion.**

Media downgrading applies to digital and non-digital media subject to release outside of the organization, whether the media is considered removable or not. When applied to system media, the downgrading process removes information from the media, typically by security category or classification level, such that the information cannot be retrieved or reconstructed. Downgrading of media includes redacting information to enable wider release and distribution. Downgrading ensures that empty space on the media is devoid of information.

### MP-8(1) Documentation of Process <a id="mp-8.1"></a>

**Control.**

Document system media downgrading actions.

**Discussion.**

Organizations can document the media downgrading process by providing information, such as the downgrading technique employed, the identification number of the downgraded media, and the identity of the individual that authorized and/or performed the downgrading action.

### MP-8(2) Equipment Testing <a id="mp-8.2"></a>

**Control.**

Test downgrading equipment and procedures [organization-defined frequency] to ensure that downgrading actions are being achieved.

**Discussion.**

None.

### MP-8(3) Controlled Unclassified Information <a id="mp-8.3"></a>

**Control.**

Downgrade system media containing controlled unclassified information prior to public release.

**Discussion.**

The downgrading of controlled unclassified information uses approved sanitization tools, techniques, and procedures.

### MP-8(4) Classified Information <a id="mp-8.4"></a>

**Control.**

Downgrade system media containing classified information prior to release to individuals without required access authorizations.

**Discussion.**

Downgrading of classified information uses approved sanitization tools, techniques, and procedures to transfer information confirmed to be unclassified from classified systems to unclassified media.
