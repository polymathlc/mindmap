// Singapore Primary Science Syllabus 2023 - Learning Outcomes
// Source: Primary Science Syllabus 2023 (May 2024)
// Structure: themes -> topics -> { coreIdeas, practices, values }

const SYLLABUS_DATA = {
    themes: [
        {
            id: 'diversity',
            name: 'Diversity',
            icon: '△□○',
            description: 'There is a great variety of living and non-living things around us.',
            topics: [
                {
                    id: 'diversity-living',
                    name: 'Diversity of Living and Non-Living Things',
                    level: 'P3',
                    coreIdeas: [
                        'Describe the characteristics of living things (need water, food, air; grow, respond, reproduce)',
                        'Recognise broad groups of plants (flowering, non-flowering)',
                        'Recognise broad groups of animals (amphibians, birds, fish, insects, mammals, reptiles)',
                        'Recognise fungi (mould, mushroom, yeast) and bacteria'
                    ],
                    practices: [
                        'Observe a variety of living and non-living things and infer differences',
                        'Classify living things into broad groups based on similarities and differences'
                    ],
                    values: [
                        'Show curiosity by questioning and exploring surrounding living and non-living things',
                        'Show care and concern by being responsible towards living things'
                    ]
                },
                {
                    id: 'diversity-materials',
                    name: 'Diversity of Materials',
                    level: 'P3',
                    coreIdeas: [
                        'Relate the use of various materials (wood, metal, ceramic, rubber, glass, plastic, fabric) to their physical properties'
                    ],
                    practices: [
                        'Compare physical properties: strength',
                        'Compare physical properties: flexibility',
                        'Compare physical properties: ability to float/sink in water',
                        'Compare physical properties: waterproof',
                        'Compare physical properties: transparency'
                    ],
                    values: [
                        'Show objectivity by using data and information to validate observations and explanations about properties and uses of materials'
                    ]
                }
            ]
        },
        {
            id: 'cycles',
            name: 'Cycles',
            icon: '↻',
            description: 'There are cycles or repeated patterns of change in nature.',
            topics: [
                {
                    id: 'cycles-life',
                    name: 'Cycles in Plants and Animals (Life Cycles)',
                    level: 'P3',
                    coreIdeas: [
                        'Different living things have different life cycles (plants, animals)'
                    ],
                    practices: [
                        'Observe and compare life cycles of plants grown from seeds',
                        'Observe and compare life cycles of animals (chicken, cockroach, frog, grasshopper, beetle, butterfly, mosquito)'
                    ],
                    values: [
                        'Show curiosity by questioning and exploring surrounding plants and animals',
                        'Show care and concern by being responsible towards plants and animals'
                    ]
                },
                {
                    id: 'cycles-reproduction-std',
                    name: 'Cycles in Plants and Animals (Reproduction)',
                    level: 'P5 Standard',
                    coreIdeas: [
                        'Recognise that a cell is a basic unit of life',
                        'Living things reproduce to ensure continuity; characteristics pass from parents to offspring',
                        'Describe pollination, fertilisation, seed dispersal and germination in flowering plants',
                        'Recognise the process of fertilisation in sexual reproduction of humans',
                        'Recognise the similarity in fertilisation between flowering plants and humans'
                    ],
                    practices: [
                        'Investigate the ways in which plants reproduce (spores, seeds)'
                    ],
                    values: [
                        'Show curiosity by questioning and exploring surrounding plants and animals',
                        'Show care and concern by being responsible towards plants and animals'
                    ]
                },
                {
                    id: 'cycles-reproduction-fdn',
                    name: 'Cycles in Plants and Animals (Reproduction)',
                    level: 'P5 Foundation',
                    coreIdeas: [
                        'State the processes in sexual reproduction of flowering plants (pollination, fertilisation, seed dispersal, germination)',
                        'State the process of fertilisation in sexual reproduction of humans'
                    ],
                    practices: [
                        'Observe and compare ways in which plants reproduce (spores, seeds)'
                    ],
                    values: [
                        'Show curiosity by questioning and exploring surrounding plants and animals',
                        'Show care and concern by being responsible towards plants and animals'
                    ]
                },
                {
                    id: 'cycles-matter',
                    name: 'Cycles in Matter and Water (Matter)',
                    level: 'P4',
                    coreIdeas: [
                        'State that matter is anything that has mass and occupies space',
                        'Differentiate among the three states of matter (solid, liquid, gas) in terms of shape and volume'
                    ],
                    practices: [
                        'Measure mass and volume using appropriate apparatus'
                    ],
                    values: [
                        'Show curiosity in exploring matter in the surroundings and question what they find'
                    ]
                },
                {
                    id: 'cycles-water-std',
                    name: 'Cycles in Matter and Water (Water)',
                    level: 'P5 Standard',
                    coreIdeas: [
                        'Recognise that water can exist in three interchangeable states of matter',
                        'Show understanding of how water changes state (melting, freezing, boiling/evaporation, condensation)',
                        'Understand melting point of ice and boiling point of water',
                        'Show understanding of the roles of evaporation and condensation in the water cycle',
                        'Recognise the importance of the water cycle',
                        'Recognise the importance of water to life processes',
                        'Describe the impact of water pollution on Earth’s water resources'
                    ],
                    practices: [
                        'Compare water in 3 states',
                        'Investigate the effect of heat gain/loss on the temperature and state of water',
                        'Investigate factors which affect the rate of evaporation (wind, temperature, exposed surface area)'
                    ],
                    values: [
                        'Show concern for water as a limited natural resource and be responsible in conserving'
                    ]
                },
                {
                    id: 'cycles-water-fdn',
                    name: 'Cycles in Matter and Water (Water)',
                    level: 'P5 Foundation',
                    coreIdeas: [
                        'Recognise that water can exist in three interchangeable states of matter',
                        'State how water changes state (melting, freezing, boiling/evaporation, condensation)',
                        'State the melting point of ice and boiling point of water',
                        'Recognise the changes in states of water in the water cycle',
                        'Recognise the importance of the water cycle'
                    ],
                    practices: [
                        'Compare water in 3 states'
                    ],
                    values: [
                        'Show concern for water as a limited natural resource and be responsible in conserving'
                    ]
                }
            ]
        },
        {
            id: 'systems',
            name: 'Systems',
            icon: '⚙',
            description: 'A system is a whole consisting of parts that work together to perform function(s).',
            topics: [
                {
                    id: 'systems-digestive',
                    name: 'Human System (Digestive System)',
                    level: 'P4',
                    coreIdeas: [
                        'Identify human systems and state their functions (digestive, respiratory, circulatory, skeletal, muscular)',
                        'Identify parts of the human digestive system (mouth, gullet, stomach, small intestine, large intestine) and describe their functions'
                    ],
                    practices: [],
                    values: [
                        'Show curiosity in questioning about the structures or functions of the body'
                    ]
                },
                {
                    id: 'systems-respiratory-std',
                    name: 'Human System (Respiratory and Circulatory Systems)',
                    level: 'P5 Standard',
                    coreIdeas: [
                        'Recognise that air is made up of gases (nitrogen, carbon dioxide, oxygen, water vapour)',
                        'Identify parts of the respiratory system (nose, windpipe, lungs) and describe their functions',
                        'Identify parts of the circulatory system (heart, blood, blood vessels) and describe their functions',
                        'Recognise the integration of digestive, respiratory and circulatory systems in life processes'
                    ],
                    practices: [
                        'Compare how plants, fish and humans take in oxygen and give out carbon dioxide',
                        'Compare ways substances are transported within plants (food/water tubes) and humans (blood vessels)'
                    ],
                    values: [
                        'Show objectivity by seeking data and information to validate observations and explanations about the human body'
                    ]
                },
                {
                    id: 'systems-respiratory-fdn',
                    name: 'Human System (Respiratory and Circulatory Systems)',
                    level: 'P5 Foundation',
                    coreIdeas: [
                        'Recognise that air is made up of gases (nitrogen, carbon dioxide, oxygen, water vapour)',
                        'Identify parts of the respiratory system (nose, windpipe, lungs) and state their functions',
                        'Identify parts of the circulatory system (heart, blood, blood vessels) and state their functions'
                    ],
                    practices: [
                        'Compare how plants and humans take in oxygen and give out carbon dioxide'
                    ],
                    values: [
                        'Show objectivity by seeking data and information to validate observations and explanations about the human body'
                    ]
                },
                {
                    id: 'systems-plant-parts',
                    name: 'Plant System (Plant Parts and Functions)',
                    level: 'P4',
                    coreIdeas: [
                        'Identify different parts of plants and state their functions (leaf, stem, root)'
                    ],
                    practices: [
                        'Observe plant parts'
                    ],
                    values: [
                        'Show curiosity in exploring the surrounding plants and question what they find',
                        'Show care and concern by being responsible towards plants'
                    ]
                },
                {
                    id: 'systems-plant-transport-std',
                    name: 'Plant System (Respiratory and Circulatory Systems)',
                    level: 'P5 Standard',
                    coreIdeas: [
                        'Identify the parts of the plant transport system and describe their functions'
                    ],
                    practices: [
                        'Investigate how food and water are transported in the plant'
                    ],
                    values: [
                        'Show objectivity by seeking data and information to validate observations about plant parts and functions',
                        'Show care and concern by being responsible towards plants'
                    ]
                },
                {
                    id: 'systems-plant-transport-fdn',
                    name: 'Plant System (Respiratory and Circulatory Systems)',
                    level: 'P5 Foundation',
                    coreIdeas: [
                        'Recognise how water is transported from roots to other plant parts',
                        'Recognise how food is transported from leaves to other plant parts'
                    ],
                    practices: [
                        'Observe how food and water are transported in the plant'
                    ],
                    values: [
                        'Show objectivity by seeking data and information to validate observations about plant parts and functions',
                        'Show care and concern by being responsible towards plants'
                    ]
                },
                {
                    id: 'systems-electrical-std',
                    name: 'Electrical System',
                    level: 'P5 Standard',
                    coreIdeas: [
                        'Recognise that an electric circuit (battery + wire + bulb + switch) forms an electrical system',
                        'Show understanding that a closed circuit allows current to flow',
                        'Identify electrical conductors and insulators'
                    ],
                    practices: [
                        'Construct simple circuits from circuit diagrams',
                        'Investigate effect of variables on current (number of batteries in series; bulbs in series and parallel)'
                    ],
                    values: [
                        'Show concern for the need to conserve and to have proper use and handling of electricity'
                    ]
                },
                {
                    id: 'systems-electrical-fdn',
                    name: 'Electrical System',
                    level: 'P5 Foundation',
                    coreIdeas: [
                        'Recognise that an electric circuit (battery + wire + bulb + switch) forms an electrical system',
                        'State that a closed circuit allows current to flow',
                        'Identify electrical conductors and insulators'
                    ],
                    practices: [
                        'Construct simple circuits from circuit diagrams',
                        'Investigate effect of variables on current (batteries in series; bulbs in series)'
                    ],
                    values: [
                        'Show concern for the need to conserve and to have proper use and handling of electricity'
                    ]
                }
            ]
        },
        {
            id: 'interactions',
            name: 'Interactions',
            icon: '↔',
            description: 'Interactions are the actions between and within living and non-living systems.',
            topics: [
                {
                    id: 'forces-magnets',
                    name: 'Interaction of Forces (Magnets)',
                    level: 'P3',
                    coreIdeas: [
                        'Recognise that a magnet can exert a push or a pull',
                        'Magnets can be made of iron or steel',
                        'Magnets have two poles; a freely suspended bar magnet points North-South',
                        'Unlike poles attract and like poles repel',
                        'Magnets attract magnetic materials',
                        'Recognise uses of magnets in everyday objects'
                    ],
                    practices: [
                        'Compare magnets, non-magnetic materials and magnetic materials',
                        'Make a magnet by the stroke method and the electrical method'
                    ],
                    values: [
                        'Show curiosity in exploring the uses of magnets in everyday life'
                    ]
                },
                {
                    id: 'forces-other-std',
                    name: 'Interaction of Forces (Frictional, Gravitational, Elastic Spring)',
                    level: 'P6 Standard',
                    coreIdeas: [
                        'Identify a force as a push or a pull',
                        'A force can move a stationary object, speed up/slow down/change direction, stop a moving object, or change its shape',
                        'Recognise different types of forces (magnetic, gravitational, elastic spring, frictional)',
                        'Recognise that objects have weight because of gravitational force acting on them'
                    ],
                    practices: [
                        'Investigate the effect of frictional force on the motion of objects',
                        'Investigate the effects of elastic spring force'
                    ],
                    values: [
                        'Show objectivity by using data and information to validate observations and explanations about forces'
                    ]
                },
                {
                    id: 'forces-other-fdn',
                    name: 'Interaction of Forces (Frictional, Gravitational)',
                    level: 'P6 Foundation',
                    coreIdeas: [
                        'Identify a force as a push or a pull',
                        'State the effects of a force (move, speed up/slow down/change direction, stop, change shape)',
                        'Recognise different types of forces (magnetic, gravitational, frictional)',
                        'Recognise that objects have weight because of gravitational force acting on them'
                    ],
                    practices: [
                        'Investigate the effect of frictional force on the motion of objects'
                    ],
                    values: [
                        'Show objectivity by using data and information to validate observations and explanations about forces'
                    ]
                },
                {
                    id: 'interactions-env-std',
                    name: 'Interactions within the Environment',
                    level: 'P6 Standard',
                    coreIdeas: [
                        'Identify factors affecting survival (physical characteristics, food availability, other organisms)',
                        'Understand effects on organisms when environment becomes unfavourable',
                        'Understand the energy pathway from the Sun; roles of producers, consumers, predators, prey in food chains and webs',
                        'Differentiate among organism, population and community',
                        'Different habitats support different communities (garden, field, pond, seashore, tree, mangrove swamp)',
                        'Adaptations enhance survival (structural or behavioural): cope with physical factors, obtain food, escape predators, reproduce',
                        'Give examples of man’s positive and negative impact on the environment'
                    ],
                    practices: [
                        'Observe, collect and record information regarding interacting factors within an environment'
                    ],
                    values: [
                        'Show care and concern for Man’s impact on the environment by being respectful and responsible'
                    ]
                },
                {
                    id: 'interactions-env-fdn',
                    name: 'Interactions within the Environment',
                    level: 'P6 Foundation',
                    coreIdeas: [
                        'Identify factors affecting survival (physical characteristics, food availability, other organisms)',
                        'Recognise the energy pathway from the Sun and roles of organisms in a food chain',
                        'Recognise that different habitats support different organisms',
                        'Recognise that adaptations enhance survival (structural or behavioural)',
                        'Give examples of man’s positive and negative impact on the environment'
                    ],
                    practices: [
                        'Observe, collect and record information regarding interacting factors within an environment'
                    ],
                    values: [
                        'Show care and concern for Man’s impact on the environment by being respectful and responsible'
                    ]
                }
            ]
        },
        {
            id: 'energy',
            name: 'Energy',
            icon: '⚡',
            description: 'Energy is required for things to work in everyday life.',
            topics: [
                {
                    id: 'energy-light',
                    name: 'Energy Forms and Uses (Light)',
                    level: 'P4',
                    coreIdeas: [
                        'Recognise that an object can be seen when it reflects light or is a source of light',
                        'Light travels in straight lines; a shadow is formed when light is blocked by an object'
                    ],
                    practices: [
                        'Investigate variables that affect shadows (shape/size/position of object; distances)'
                    ],
                    values: [
                        'Show objectivity by using data and information to validate observations and explanations about light'
                    ]
                },
                {
                    id: 'energy-heat',
                    name: 'Energy Forms and Uses (Heat)',
                    level: 'P4',
                    coreIdeas: [
                        'Identify some common sources of heat',
                        'Temperature is a measurement of an object’s degree of hotness',
                        'Heat is a form of energy',
                        'Differentiate between heat and temperature',
                        'Heat flows from hotter to colder until both reach the same temperature',
                        'Relate change in temperature to heat gain or loss',
                        'List effects of heat gain/loss (contraction/expansion; change in state)',
                        'Identify good (metals) and poor (wood, plastics, air, rubber) conductors of heat'
                    ],
                    practices: [
                        'Measure temperature using a thermometer and a datalogger'
                    ],
                    values: [
                        'Show objectivity by seeking data and information to validate observations and explanations about heat'
                    ]
                },
                {
                    id: 'energy-photo-std',
                    name: 'Energy Forms and Uses (Photosynthesis)',
                    level: 'P6 Standard',
                    coreIdeas: [
                        'Living things need energy from respiration to carry out life processes',
                        'The Sun is our primary source of energy (light and heat)',
                        'Differentiate between the ways plants and animals obtain energy'
                    ],
                    practices: [
                        'Investigate the requirements (water, light, carbon dioxide) for photosynthesis (produces sugar and oxygen)'
                    ],
                    values: [
                        'Show objectivity by using data and information to validate observations and explanations about photosynthesis'
                    ]
                },
                {
                    id: 'energy-photo-fdn',
                    name: 'Energy Forms and Uses (Photosynthesis)',
                    level: 'P6 Foundation',
                    coreIdeas: [
                        'The Sun is our primary source of energy (light and heat)'
                    ],
                    practices: [
                        'Investigate the requirements (water, light, carbon dioxide) for photosynthesis (produces sugar and oxygen)'
                    ],
                    values: [
                        'Show objectivity by using data and information to validate observations and explanations about photosynthesis'
                    ]
                },
                {
                    id: 'energy-conversion',
                    name: 'Energy Conversion',
                    level: 'P6 Standard',
                    coreIdeas: [
                        'Energy from most energy resources is derived in some ways from the Sun',
                        'Recognise various forms of energy (kinetic, potential, light, electrical, sound, heat)'
                    ],
                    practices: [
                        'Investigate energy conversion from one form to another'
                    ],
                    values: [
                        'Show care and concern by being responsible in conserving energy in everyday life'
                    ]
                }
            ]
        }
    ]
};
