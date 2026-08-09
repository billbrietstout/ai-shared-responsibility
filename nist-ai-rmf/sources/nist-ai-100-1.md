# Artificial Intelligence Risk Management Framework (AI RMF 1.0)

```
doc_id: nist-ai-100-1
nist_id: NIST.AI.100-1
version: 1.0
published: 2023-01-26
doi: https://doi.org/10.6028/NIST.AI.100-1
pdf: https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-1.pdf
disclaimer: Structured Markdown extract for demo retrieval. Not official NIST output.
```

> **Applicability:** Voluntary, rights-preserving, non-sector-specific, and use-case agnostic. Complements sector profiles such as NIST.AI.600-1 (Generative AI). Cite the official DOI for normative use.

## Executive Summary

<a id="executive-summary"></a>

Artificial intelligence (AI) technologies have significant potential to transform society and people's lives — from commerce and health to transportation and cybersecurity to the environment. AI technologies also pose risks that can negatively impact individuals, groups, organizations, communities, society, the environment, and the planet.

The AI RMF refers to an AI system as an engineered or machine-based system that can, for a given set of objectives, generate outputs such as predictions, recommendations, or decisions influencing real or virtual environments. AI systems are designed to operate with varying levels of autonomy (adapted from OECD Recommendation on AI:2019; ISO/IEC 22989:2022).

As directed by the National Artificial Intelligence Initiative Act of 2020 (P.L. 116-283), the goal of the AI RMF is to offer a resource to the organizations designing, developing, deploying, or using AI systems to help manage the many risks of AI and promote trustworthy and responsible development and use of AI systems.

The Framework is divided into two parts. Part 1 discusses how organizations can frame the risks related to AI, describes the intended audience, and analyzes AI risks and trustworthiness. Part 2 comprises the Core of the Framework: four functions — GOVERN, MAP, MEASURE, and MANAGE — broken down into categories and subcategories. While GOVERN applies to all stages of organizations' AI risk management processes, MAP, MEASURE, and MANAGE can be applied in AI system-specific contexts and at specific stages of the AI lifecycle.

## Framing Risk

<a id="framing-risk"></a>

In the context of the AI RMF, risk refers to the composite measure of an event's probability of occurring and the magnitude or degree of the consequences of the corresponding event. The impacts, or consequences, of AI systems can be positive, negative, or both and can result in opportunities or threats (adapted from ISO 31000:2018). Negative impact or harm can be experienced by individuals, groups, communities, organizations, society, the environment, and the planet.

Risk management refers to coordinated activities to direct and control an organization with regard to risk (ISO 31000:2018). While risk management processes generally address negative impacts, this Framework offers approaches to minimize anticipated negative impacts of AI systems and identify opportunities to maximize positive impacts.

### Challenges for AI Risk Management

<a id="risk-challenges"></a>

**Risk measurement.** AI risks can be difficult to measure. Some AI system impacts may be difficult to measure quantitatively or may involve qualitative or mixed approaches. Metrics can be oversimplified, gamed, or may not generalize across contexts. Lack of reliable measurement can impede accountability and risk prioritization.

**Risk tolerance.** Organizations establish risk tolerance — the readiness to bear risk in order to achieve objectives — based on values, culture, legal requirements, and stakeholder expectations. Risk tolerance informs go/no-go decisions and residual-risk acceptance.

**Risk prioritization.** Not all AI risks can be eliminated. Organizations prioritize based on impact, likelihood, and resources, with higher priority for risks that threaten life, liberty, civil rights, safety, or critical functions.

**Organizational integration.** AI risk management should integrate with existing enterprise risk, cybersecurity, privacy, and safety programs rather than operate as an isolated process.

## AI Risks and Trustworthiness

<a id="trustworthiness"></a>

Characteristics of trustworthy AI systems include: valid and reliable, safe, secure and resilient, accountable and transparent, explainable and interpretable, privacy-enhanced, and fair with harmful bias managed. Creating trustworthy AI requires balancing each of these characteristics based on the AI system's context of use. Neglecting these characteristics can increase the probability and magnitude of negative consequences. Tradeoffs are usually involved; rarely do all characteristics apply equally in every setting.

### Valid and Reliable

<a id="valid-and-reliable"></a>

Validation is the confirmation, through the provision of objective evidence, that the requirements for a specific intended use or application have been fulfilled (ISO 9000:2015). Reliability is the ability of an item to perform as required, without failure, for a given time interval, under given conditions (ISO/IEC TS 5723:2022). Accuracy and robustness contribute to validity and trustworthiness. Deployment of AI systems which are inaccurate, unreliable, or poorly generalized to data and settings beyond their training creates and increases negative AI risks and reduces trustworthiness. Validity and reliability for deployed AI systems are often assessed by ongoing testing or monitoring that confirms a system is performing as intended.

### Safe

<a id="safe"></a>

AI systems should not, under defined conditions, lead to a state in which human life, health, property, or the environment is endangered (ISO/IEC TS 5723:2022). Safe operation is improved through responsible design, development, and deployment practices; clear information to deployers on responsible use; responsible decision-making by deployers and end users; and explanations and documentation of risks based on empirical evidence of incidents. Safety risks that pose a potential risk of serious injury or death call for the most urgent prioritization.

### Secure and Resilient

<a id="secure-and-resilient"></a>

AI systems may be said to be resilient if they can withstand unexpected adverse events or unexpected changes in their environment or use, or if they can maintain their functions and structure in the face of internal and external change and degrade safely and gracefully when necessary. Common security concerns relate to adversarial examples, data poisoning, and the exfiltration of models, training data, or other intellectual property through AI system endpoints. Security and resilience are related but distinct: resilience is the ability to return to normal function after an unexpected adverse event; security also encompasses protocols to avoid, protect against, respond to, or recover from attacks.

### Accountable and Transparent

<a id="accountable-and-transparent"></a>

Trustworthy AI depends upon accountability. Accountability presupposes transparency. Transparency reflects the extent to which information about an AI system and its outputs is available to individuals interacting with such a system. Meaningful transparency provides access to appropriate levels of information based on the stage of the AI lifecycle and tailored to the role or knowledge of AI actors. Maintaining the provenance of training data and supporting attribution of the AI system's decisions to subsets of training data can assist with both transparency and accountability.

### Explainable and Interpretable

<a id="explainable-and-interpretable"></a>

Explainability refers to a representation of the mechanisms underlying AI systems' operation, whereas interpretability refers to the meaning of AI systems' output in the context of their designed functional purposes. Transparency can answer what happened in the system; explainability can answer how a decision was made; interpretability can answer why a decision was made and its meaning or context to the user.

### Privacy-Enhanced

<a id="privacy-enhanced"></a>

Privacy refers generally to the norms and practices that help to safeguard human autonomy, identity, and dignity. Privacy values such as anonymity, confidentiality, and control generally should guide choices for AI system design, development, and deployment. Privacy-enhancing technologies for AI, as well as data minimizing methods such as de-identification and aggregation for certain model outputs, can support design for privacy-enhanced AI systems.

### Fair — with Harmful Bias Managed

<a id="fair-bias-managed"></a>

Fairness in AI includes concerns for equality and equity by addressing issues such as harmful bias and discrimination. NIST has identified three major categories of AI bias to be considered and managed: systemic, computational and statistical, and human-cognitive. Each can occur in the absence of prejudice, partiality, or discriminatory intent. AI systems can potentially increase the speed and scale of biases and perpetuate and amplify harms.

## AI RMF Core

<a id="core"></a>

The AI RMF Core provides outcomes and actions that enable dialogue, understanding, and activities to manage AI risks and responsibly develop trustworthy AI systems. The Core is composed of four functions: GOVERN, MAP, MEASURE, and MANAGE. Each high-level function is broken down into categories and subcategories. Categories and subcategories are subdivided into specific actions and outcomes. Actions do not constitute a checklist, nor are they necessarily an ordered set of steps.

Governance is designed to be a cross-cutting function to inform and be infused throughout the other three functions. Assuming a governance structure is in place, functions may be performed in any order across the AI lifecycle as deemed to add value. After instituting the outcomes in GOVERN, most users would start with MAP and continue to MEASURE or MANAGE. The process should be iterative, with cross-referencing between functions as necessary.

## GOVERN

<a id="gov"></a>

The GOVERN function cultivates and implements a culture of risk management within organizations designing, developing, deploying, evaluating, or acquiring AI systems. It outlines processes and organizational schemes that anticipate, identify, and manage the risks a system can pose; incorporates processes to assess potential impacts; aligns AI risk management with organizational principles and strategic priorities; connects technical aspects of AI system design and development to organizational values; and addresses the full product lifecycle including third-party software, hardware, and data. GOVERN is a cross-cutting function infused throughout AI risk management.

### GOVERN 1: Policies, processes, procedures, and practices across the organization related to the mapping, measuring, and managing of AI risks are in place, transparent, and implemented effectively.

<a id="gov-1"></a>

#### GOVERN 1.1

<a id="gov-1-1"></a>

Legal and regulatory requirements involving AI are understood, managed, and documented.

#### GOVERN 1.2

<a id="gov-1-2"></a>

The characteristics of trustworthy AI are integrated into organizational policies, processes, procedures, and practices.

#### GOVERN 1.3

<a id="gov-1-3"></a>

Processes, procedures, and practices are in place to determine the needed level of risk management activities based on the organization's risk tolerance.

#### GOVERN 1.4

<a id="gov-1-4"></a>

The risk management process and its outcomes are established through transparent policies, procedures, and other controls based on organizational risk priorities.

#### GOVERN 1.5

<a id="gov-1-5"></a>

Ongoing monitoring and periodic review of the risk management process and its outcomes are planned and organizational roles and responsibilities clearly defined, including determining the frequency of periodic review.

#### GOVERN 1.6

<a id="gov-1-6"></a>

Mechanisms are in place to inventory AI systems and are resourced according to organizational risk priorities.

#### GOVERN 1.7

<a id="gov-1-7"></a>

Processes and procedures are in place for decommissioning and phasing out AI systems safely and in a manner that does not increase risks or decrease the organization's trustworthiness.

### GOVERN 2: Accountability structures are in place so that the appropriate teams and individuals are empowered, responsible, and trained for mapping, measuring, and managing AI risks.

<a id="gov-2"></a>

#### GOVERN 2.1

<a id="gov-2-1"></a>

Roles and responsibilities and lines of communication related to mapping, measuring, and managing AI risks are documented and are clear to individuals and teams throughout the organization.

#### GOVERN 2.2

<a id="gov-2-2"></a>

The organization's personnel and partners receive AI risk management training to enable them to perform their duties and responsibilities consistent with related policies, procedures, and agreements.

#### GOVERN 2.3

<a id="gov-2-3"></a>

Executive leadership of the organization takes responsibility for decisions about risks associated with AI system development and deployment.

### GOVERN 3: Workforce diversity, equity, inclusion, and accessibility processes are prioritized in the mapping, measuring, and managing of AI risks throughout the lifecycle.

<a id="gov-3"></a>

#### GOVERN 3.1

<a id="gov-3-1"></a>

Decision-making related to mapping, measuring, and managing AI risks throughout the lifecycle is informed by a diverse team (e.g., diversity of demographics, disciplines, experience, expertise, and backgrounds).

#### GOVERN 3.2

<a id="gov-3-2"></a>

Policies and procedures are in place to define and differentiate roles and responsibilities for human-AI configurations and oversight of AI systems.

### GOVERN 4: Organizational teams are committed to a culture that considers and communicates AI risk.

<a id="gov-4"></a>

#### GOVERN 4.1

<a id="gov-4-1"></a>

Organizational policies and practices are in place to foster a critical thinking and safety-first mindset in the design, development, deployment, and uses of AI systems to minimize potential negative impacts.

#### GOVERN 4.2

<a id="gov-4-2"></a>

Organizational teams document the risks and potential impacts of the AI technology they design, develop, deploy, evaluate, and use, and they communicate about the impacts more broadly.

#### GOVERN 4.3

<a id="gov-4-3"></a>

Organizational practices are in place to enable AI testing, identification of incidents, and information sharing.

### GOVERN 5: Processes are in place for robust engagement with relevant AI actors.

<a id="gov-5"></a>

#### GOVERN 5.1

<a id="gov-5-1"></a>

Organizational policies and practices are in place to collect, consider, prioritize, and integrate feedback from those external to the team that developed or deployed the AI system regarding the potential individual and societal impacts related to AI risks.

#### GOVERN 5.2

<a id="gov-5-2"></a>

Mechanisms are established to enable the team that developed or deployed AI systems to regularly incorporate adjudicated feedback from relevant AI actors into system design and implementation.

### GOVERN 6: Policies and procedures are in place to address AI risks and benefits arising from third-party software and data and other supply chain issues.

<a id="gov-6"></a>

#### GOVERN 6.1

<a id="gov-6-1"></a>

Policies and procedures are in place that address AI risks associated with third-party entities, including risks of infringement of a third-party's intellectual property or other rights.

#### GOVERN 6.2

<a id="gov-6-2"></a>

Contingency processes are in place to handle failures or incidents in third-party data or AI systems deemed to be high-risk.

## MAP

<a id="map"></a>

The MAP function establishes the context to frame risks related to an AI system. Interdependencies between lifecycle activities and among AI actors can make it difficult to reliably anticipate impacts. The information gathered while carrying out MAP enables negative risk prevention and informs decisions such as model management and an initial decision about appropriateness or the need for an AI solution. Outcomes in MAP are the basis for MEASURE and MANAGE. After completing MAP, users should have sufficient contextual knowledge to inform an initial go/no-go decision about whether to design, develop, or deploy an AI system.

### MAP 1: Context is established and understood.

<a id="map-1"></a>

#### MAP 1.1

<a id="map-1-1"></a>

Intended purposes, potentially beneficial uses, context-specific laws, norms and expectations, and prospective settings in which the AI system will be deployed are understood and documented. Considerations include: the specific set or types of users along with their expectations; potential positive and negative impacts of system uses to individuals, communities, organizations, society, and the planet; assumptions and related limitations about AI system purposes, uses, and risks across the development or product AI lifecycle; and related TEVV and system metrics.

#### MAP 1.2

<a id="map-1-2"></a>

Interdisciplinary AI actors, competencies, skills, and capacities for establishing context reflect demographic diversity and broad domain and user experience expertise, and their participation is documented. Opportunities for interdisciplinary collaboration are prioritized.

#### MAP 1.3

<a id="map-1-3"></a>

The organization's mission and relevant goals for AI technology are understood and documented.

#### MAP 1.4

<a id="map-1-4"></a>

The business value or context of business use has been clearly defined or — in the case of assessing existing AI systems — re-evaluated.

#### MAP 1.5

<a id="map-1-5"></a>

Organizational risk tolerances are determined and documented.

#### MAP 1.6

<a id="map-1-6"></a>

System requirements (e.g., "the system shall respect the privacy of its users") are elicited from and understood by relevant AI actors. Design decisions take socio-technical implications into account to address AI risks.

### MAP 2: Categorization of the AI system is performed.

<a id="map-2"></a>

#### MAP 2.1

<a id="map-2-1"></a>

The specific tasks and methods used to implement the tasks that the AI system will support are defined (e.g., classifiers, generative models, recommenders).

#### MAP 2.2

<a id="map-2-2"></a>

Information about the AI system's knowledge limits and how system output may be utilized and overseen by humans is documented. Documentation provides sufficient information to assist relevant AI actors when making decisions and taking subsequent actions.

#### MAP 2.3

<a id="map-2-3"></a>

Scientific integrity and TEVV considerations are identified and documented, including those related to experimental design, data collection and selection (e.g., availability, representativeness, suitability), system trustworthiness, and construct validation.

### MAP 3: AI capabilities, targeted usage, goals, and expected benefits and costs compared with appropriate benchmarks are understood.

<a id="map-3"></a>

#### MAP 3.1

<a id="map-3-1"></a>

Potential benefits of intended AI system functionality and performance are examined and documented.

#### MAP 3.2

<a id="map-3-2"></a>

Potential costs, including non-monetary costs, which result from expected or realized AI errors or system functionality and trustworthiness — as connected to organizational risk tolerance — are examined and documented.

#### MAP 3.3

<a id="map-3-3"></a>

Targeted application scope is specified and documented based on the system's capability, established context, and AI system categorization.

#### MAP 3.4

<a id="map-3-4"></a>

Processes for operator and practitioner proficiency with AI system performance and trustworthiness — and relevant technical standards and certifications — are defined, assessed, and documented.

#### MAP 3.5

<a id="map-3-5"></a>

Processes for human oversight are defined, assessed, and documented in accordance with organizational policies from the GOVERN function.

### MAP 4: Risks and benefits are mapped for all components of the AI system including third-party software and data.

<a id="map-4"></a>

#### MAP 4.1

<a id="map-4-1"></a>

Approaches for mapping AI technology and legal risks of its components — including the use of third-party data or software — are in place, followed, and documented, as are risks of infringement of a third party's intellectual property or other rights.

#### MAP 4.2

<a id="map-4-2"></a>

Internal risk controls for components of the AI system, including third-party AI technologies, are identified and documented.

### MAP 5: Impacts to individuals, groups, communities, organizations, and society are characterized.

<a id="map-5"></a>

#### MAP 5.1

<a id="map-5-1"></a>

Likelihood and magnitude of each identified impact (both potentially beneficial and harmful) based on expected use, past uses of AI systems in similar contexts, public incident reports, feedback from those external to the team that developed or deployed the AI system, or other data are identified and documented.

#### MAP 5.2

<a id="map-5-2"></a>

Practices and personnel for supporting regular engagement with relevant AI actors and integrating feedback about positive, negative, and unanticipated impacts are in place and documented.

## MEASURE

<a id="measure"></a>

The MEASURE function employs quantitative, qualitative, or mixed-method tools, techniques, and methodologies to analyze, assess, benchmark, and monitor AI risk and related impacts. It uses knowledge from MAP and informs MANAGE. AI systems should be tested before deployment and regularly while in operation. After completing MEASURE, objective, repeatable, or scalable test, evaluation, verification, and validation (TEVV) processes including metrics, methods, and methodologies are in place, followed, and documented.

### MEASURE 1: Appropriate methods and metrics are identified and applied.

<a id="measure-1"></a>

#### MEASURE 1.1

<a id="measure-1-1"></a>

Approaches and metrics for measurement of AI risks enumerated during the MAP function are selected for implementation starting with the most significant AI risks. The risks or trustworthiness characteristics that will not — or cannot — be measured are properly documented.

#### MEASURE 1.2

<a id="measure-1-2"></a>

Appropriateness of AI metrics and effectiveness of existing controls are regularly assessed and updated, including reports of errors and potential impacts on affected communities.

#### MEASURE 1.3

<a id="measure-1-3"></a>

Internal experts who did not serve as front-line developers for the system and/or independent assessors are involved in regular assessments and updates. Domain experts, users, AI actors external to the team that developed or deployed the AI system, and affected communities are consulted in support of assessments as necessary per organizational risk tolerance.

### MEASURE 2: AI systems are evaluated for trustworthy characteristics.

<a id="measure-2"></a>

#### MEASURE 2.1

<a id="measure-2-1"></a>

Test sets, metrics, and details about the tools used during TEVV are documented.

#### MEASURE 2.2

<a id="measure-2-2"></a>

Evaluations involving human subjects meet applicable requirements (including human subject protection) and are representative of the relevant population.

#### MEASURE 2.3

<a id="measure-2-3"></a>

AI system performance or assurance criteria are measured qualitatively or quantitatively and demonstrated for conditions similar to deployment setting(s). Measures are documented.

#### MEASURE 2.4

<a id="measure-2-4"></a>

The functionality and behavior of the AI system and its components — as identified in the MAP function — are monitored when in production.

#### MEASURE 2.5

<a id="measure-2-5"></a>

The AI system to be deployed is demonstrated to be valid and reliable. Limitations of the generalizability beyond the conditions under which the technology was developed are documented.

#### MEASURE 2.6

<a id="measure-2-6"></a>

The AI system is evaluated regularly for safety risks — as identified in the MAP function. The AI system to be deployed is demonstrated to be safe, its residual negative risk does not exceed the risk tolerance, and it can fail safely, particularly if made to operate beyond its knowledge limits. Safety metrics reflect system reliability and robustness, real-time monitoring, and response times for AI system failures.

#### MEASURE 2.7

<a id="measure-2-7"></a>

AI system security and resilience — as identified in the MAP function — are evaluated and documented.

#### MEASURE 2.8

<a id="measure-2-8"></a>

Risks associated with transparency and accountability — as identified in the MAP function — are examined and documented.

#### MEASURE 2.9

<a id="measure-2-9"></a>

The AI model is explained, validated, and documented, and AI system output is interpreted within its context — as identified in the MAP function — to inform responsible use and governance.

#### MEASURE 2.10

<a id="measure-2-10"></a>

Privacy risk of the AI system — as identified in the MAP function — is examined and documented.

#### MEASURE 2.11

<a id="measure-2-11"></a>

Fairness and bias — as identified in the MAP function — are evaluated and results are documented.

#### MEASURE 2.12

<a id="measure-2-12"></a>

Environmental impact and sustainability of AI model training and management activities — as identified in the MAP function — are assessed and documented.

#### MEASURE 2.13

<a id="measure-2-13"></a>

Effectiveness of the employed TEVV metrics and processes in the MEASURE function are evaluated and documented.

### MEASURE 3: Mechanisms for tracking identified AI risks over time are in place.

<a id="measure-3"></a>

#### MEASURE 3.1

<a id="measure-3-1"></a>

Approaches, personnel, and documentation are in place to regularly identify and track existing, unanticipated, and emergent AI risks based on factors such as intended and actual performance in deployed contexts.

#### MEASURE 3.2

<a id="measure-3-2"></a>

Risk tracking approaches are considered for settings where AI risks are difficult to assess using currently available measurement techniques or where metrics are not yet available.

#### MEASURE 3.3

<a id="measure-3-3"></a>

Feedback processes for end users and impacted communities to report problems and appeal system outcomes are established and integrated into AI system evaluation metrics.

### MEASURE 4: Feedback about efficacy of measurement is gathered and assessed.

<a id="measure-4"></a>

#### MEASURE 4.1

<a id="measure-4-1"></a>

Measurement approaches for identifying AI risks are connected to deployment context(s) and informed through consultation with domain experts and other end users. Approaches are documented.

#### MEASURE 4.2

<a id="measure-4-2"></a>

Measurement results regarding AI system trustworthiness in deployment context(s) and across the AI lifecycle are informed by input from domain experts and relevant AI actors to validate whether the system is performing consistently as intended. Results are documented.

#### MEASURE 4.3

<a id="measure-4-3"></a>

Measurable performance improvements or declines based on consultations with relevant AI actors, including affected communities, and field data about context-relevant risks and trustworthiness characteristics are identified and documented.

## MANAGE

<a id="manage"></a>

The MANAGE function entails allocating risk resources to mapped and measured risks on a regular basis and as defined by GOVERN. Risk treatment comprises plans to respond to, recover from, and communicate about incidents or events. After completing MANAGE, plans for prioritizing risk and regular monitoring and improvement will be in place.

### MANAGE 1: AI risks based on assessments and other analytical output from the MAP and MEASURE functions are prioritized, responded to, and managed.

<a id="manage-1"></a>

#### MANAGE 1.1

<a id="manage-1-1"></a>

A determination is made as to whether the AI system achieves its intended purposes and stated objectives and whether its development or deployment should proceed.

#### MANAGE 1.2

<a id="manage-1-2"></a>

Treatment of documented AI risks is prioritized based on impact, likelihood, and available resources or methods.

#### MANAGE 1.3

<a id="manage-1-3"></a>

Responses to the AI risks deemed high priority, as identified by the MAP function, are developed, planned, and documented. Risk response options can include mitigating, transferring, avoiding, or accepting.

#### MANAGE 1.4

<a id="manage-1-4"></a>

Negative residual risks (defined as the sum of all unmitigated risks) to both downstream acquirers of AI systems and end users are documented.

### MANAGE 2: Strategies to maximize AI benefits and minimize negative impacts are planned, prepared, implemented, documented, and informed by input from relevant AI actors.

<a id="manage-2"></a>

#### MANAGE 2.1

<a id="manage-2-1"></a>

Resources required to manage AI risks are taken into account — along with viable non-AI alternative systems, approaches, or methods — to reduce the magnitude or likelihood of potential impacts.

#### MANAGE 2.2

<a id="manage-2-2"></a>

Mechanisms are in place and applied to sustain the value of deployed AI systems.

#### MANAGE 2.3

<a id="manage-2-3"></a>

Procedures are followed to respond to and recover from a previously unknown risk when it is identified.

#### MANAGE 2.4

<a id="manage-2-4"></a>

Mechanisms are in place and applied, and responsibilities are assigned and understood, to supersede, disengage, or deactivate AI systems that demonstrate performance or outcomes inconsistent with intended use.

### MANAGE 3: AI risks and benefits from third-party entities are managed.

<a id="manage-3"></a>

#### MANAGE 3.1

<a id="manage-3-1"></a>

AI risks and benefits from third-party resources are regularly monitored, and risk controls are applied and documented.

#### MANAGE 3.2

<a id="manage-3-2"></a>

Pre-trained models which are used for development are monitored as part of AI system regular monitoring and maintenance.

### MANAGE 4: Risk treatments, including response and recovery, and communication plans for the identified and measured AI risks are documented and monitored regularly.

<a id="manage-4"></a>

#### MANAGE 4.1

<a id="manage-4-1"></a>

Post-deployment AI system monitoring plans are implemented, including mechanisms for capturing and evaluating input from users and other relevant AI actors, appeal and override, decommissioning, incident response, recovery, and change management.

#### MANAGE 4.2

<a id="manage-4-2"></a>

Measurable activities for continual improvements are integrated into AI system updates and include regular engagement with interested parties, including relevant AI actors.

#### MANAGE 4.3

<a id="manage-4-3"></a>

Incidents and errors are communicated to relevant AI actors, including affected communities. Processes for tracking, responding to, and recovering from incidents and errors are followed and documented.

## AI RMF Profiles

<a id="profiles"></a>

AI RMF use-case profiles are implementations of the AI RMF functions, categories, and subcategories for a specific setting or application based on the requirements, risk tolerance, and resources of the Framework user. Profiles may illustrate how risk can be managed at various stages of the AI lifecycle or in specific sector, technology, or end-use applications.

AI RMF temporal profiles describe either the current state or the desired target state of specific AI risk management activities. Comparing Current and Target Profiles reveals gaps to be addressed.

AI RMF cross-sectoral profiles cover risks of models or applications that can be used across use cases or sectors — for example, large language models, cloud-based services, or acquisition. The Generative AI Profile (NIST.AI.600-1) is a cross-sectoral profile companion to this Framework.

## How AI Risks Differ from Traditional Software Risks

<a id="appendix-b"></a>

AI risks differ from traditional software risks in several ways. AI systems may be trained on data that can change over time, affecting functionality and trustworthiness in ways that are hard to understand. AI systems and their deployment contexts are frequently complex, making failures hard to detect and respond to. AI systems are inherently socio-technical: risks and benefits emerge from the interplay of technical aspects with societal factors related to how a system is used, its interactions with other AI systems, who operates it, and the social context in which it is deployed. Without proper controls, AI systems can amplify, perpetuate, or exacerbate inequitable or undesirable outcomes.

## AI Risk Management and Human-AI Interaction

<a id="appendix-c"></a>

Human-AI interaction and configuration decisions affect risk. Humans may oversee AI systems, collaborate with them, or be subject to their outputs. Policies and procedures should define roles and responsibilities for human-AI configurations and oversight (see GOVERN 3.2 and MAP 3.5). Measurement should consider human-AI teaming, automation bias, and the adequacy of human intervention when systems operate beyond knowledge limits.
