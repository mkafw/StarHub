// 预设分类配置
export interface CategoryPreset {
  name: string // 中文名称（用于显示和匹配）
  nameEn: string // 英文名称
  emoji: string // Emoji 图标
  description: string
  descriptionEn: string // 英文描述
  color: string
  keywords: string[]
}

// 默认预设分类


// export const DEFAULT_CATEGORIES: CategoryPreset[] = [
//   {
//     name: 'Python 开发生态',
//     nameEn: 'Python Ecosystem',
//     emoji: '🐍',
//     description: '与 Python 语言、生态和脚本相关的项目',
//     descriptionEn: 'Projects related to Python language and ecosystem',
//     color: '#3572A5',
//     keywords: ['python','pandas','numpy','jupyter','script','automation','cli','package','library','data']
//   },
//   {
//     name: '前端开发',
//     nameEn: 'Frontend Development',
//     emoji: '🌐',
//     description: '网页前端开发与页面交互',
//     descriptionEn: 'Frontend development and UI interaction',
//     color: '#1E90FF',
//     keywords: ['frontend','html','css','javascript','react','vue','vite','dom','spa','components']
//   },
//   {
//     name: '用户界面组件',
//     nameEn: 'User Interface Components',
//     emoji: '🎨',
//     description: '界面组件与设计系统',
//     descriptionEn: 'UI components and design systems',
//     color: '#FFB000',
//     keywords: ['ui','component','widget','theme','icons','design','layout','dashboard','controls','navigation']
//   },
//   {
//     name: '深度学习',
//     nameEn: 'Deep Learning',
//     emoji: '🧠',
//     description: '神经网络、模型训练与推理相关项目',
//     descriptionEn: 'Neural networks, model training and inference',
//     color: '#7C4DFF',
//     keywords: [
//       'deep-learning','neural-network','dl','pytorch','tensorflow',
//       'model','training','inference','cnn','rnn','transformer'
//     ]
//   },
//   {
//     name: '博客与知识分享',
//     nameEn: 'Blogs & Knowledge Sharing',
//     emoji: '✍️',
//     description: '博客与知识记录',
//     descriptionEn: 'Blogs and knowledge sharing',
//     color: '#FF7F50',
//     keywords: ['blog','markdown','post','article','cms','static','jekyll','hugo','content','publish']
//   },
//   {
//     name: '科学绘图与可视化',
//     nameEn: 'Scientific Plotting & Charts',
//     emoji: '📊',
//     description: '科研绘图与图表',
//     descriptionEn: 'Scientific plotting and charts',
//     color: '#4CAF50',
//     keywords: ['plot','chart','matplotlib','seaborn','figure','graph','heatmap','axis','legend','render']
//   },
//   {
//     name: '课程与学习资料',
//     nameEn: 'Courses & Learning Materials',
//     emoji: '🎓',
//     description: '教程与学习资源',
//     descriptionEn: 'Courses and learning materials',
//     color: '#2E8B57',
//     keywords: ['course','tutorial','lesson','training','lecture','assignment','study','education','slides','examples']
//   },
//   {
//     name: 'Django 框架',
//     nameEn: 'Django Framework',
//     emoji: '🕸️',
//     description: 'Django 相关项目',
//     descriptionEn: 'Django related projects',
//     color: '#092E20',
//     keywords: ['django','orm','admin',' template','rest','middleware','forms','backend','routing','serializer']
//   },
//   {
//     name: '文档与手册',
//     nameEn: 'Documentation & Manuals',
//     emoji: '📚',
//     description: '项目说明与文档系统',
//     descriptionEn: 'Documentation and manuals',
//     color: '#795548',
//     keywords: ['docs','documentation','manual','guide','readme','reference','usage','wiki','markdown','help']
//   },
//   {
//     name: '其他项目',
//     nameEn: 'Miscellaneous Projects',
//     emoji: '📦',
//     description: '暂无法分类的项目',
//     descriptionEn: 'Uncategorized projects',
//     color: '#A9A9A9',
//     keywords: ['misc','general','random','mixed','prototype','test','sandbox','toolkit','various','experiment']
//   },
//   {
//     name: '项目模板',
//     nameEn: 'Project Templates',
//     emoji: '🧩',
//     description: '脚手架与模板工程',
//     descriptionEn: 'Project starters and templates',
//     color: '#8A2BE2',
//     keywords: ['template','starter','scaffold','boilerplate','seed','structure','init','setup','example','base']
//   },
//   {
//     name: '后台管理系统',
//     nameEn: 'Admin Dashboards',
//     emoji: '🛠️',
//     description: '管理后台与控制台',
//     descriptionEn: 'Admin panels and dashboards',
//     color: '#FF6347',
//     keywords: ['admin','dashboard','panel','crud','management','analytics','settings','roles','table','monitor']
//   },
//   {
//     name: '代码手册与示例',
//     nameEn: 'Code Cookbooks',
//     emoji: '🍳',
//     description: '代码示例与经验集合',
//     descriptionEn: 'Code recipes and examples',
//     color: '#9C27B0',
//     keywords: ['cookbook','snippet','example','recipe','tips','pattern','best-practice','helper','reference','guide']
//   },
//   {
//     name: 'WebGIS 应用',
//     nameEn: 'WebGIS Applications',
//     emoji: '🗺️',
//     description: '在线地图与地理信息应用',
//     descriptionEn: 'Web-based GIS applications',
//     color: '#00AAFF',
//     keywords: ['webgis','map','tiles','geoserver','vector','raster','wms','wfs','overlay','interaction']
//   },
//   {
//     name: 'Cesium 三维地球',
//     nameEn: 'CesiumJS 3D Globe',
//     emoji: '🌍',
//     description: '三维地球与三维可视化',
//     descriptionEn: '3D globe visualization',
//     color: '#2F80ED',
//     keywords: ['cesium','3d','globe','terrain','tileset','gltf','czml','scene','viewer','visualization']
//   },
//   {
//     name: '地理空间工具',
//     nameEn: 'Geospatial Tools',
//     emoji: '📌',
//     description: '地理空间计算工具',
//     descriptionEn: 'Geospatial utilities',
//     color: '#26A69A',
//     keywords: ['geospatial','coordinates','geodesy','wkt','wkb','tile','index','quadkey','parser','converter']
//   },
//   {
//     name: 'GIS 工具',
//     nameEn: 'GIS Applications & Tools',
//     emoji: '🛰️',
//     description: '地理信息系统工具',
//     descriptionEn: 'General GIS tools',
//     color: '#4B7BEC',
//     keywords: ['gis','spatial','overlay','buffer','topology','projection','raster','vector','mapping','analysis']
//   },
//   {
//     name: 'Leaflet 生态',
//     nameEn: 'Leaflet Ecosystem',
//     emoji: '🍃',
//     description: 'Leaflet 插件与地图功能',
//     descriptionEn: 'Leaflet plugins and tools',
//     color: '#32CD32',
//     keywords: ['leaflet','marker','popup','heatmap','cluster','tilelayer','control','draw','geojson','zoom']
//   },
//   {
//     name: 'Mapbox 生态',
//     nameEn: 'Mapbox Ecosystem',
//     emoji: '🗺️✨',
//     description: 'Mapbox 可视化生态',
//     descriptionEn: 'Mapbox mapping ecosystem',
//     color: '#3F51B5',
//     keywords: ['mapbox','gl','style','vector-tiles','navigation','dataset','source','layer','camera','render']
//   },
//   {
//     name: 'OpenLayers 生态',
//     nameEn: 'OpenLayers Ecosystem',
//     emoji: '🧭',
//     description: '专业 WebGIS SDK',
//     descriptionEn: 'Professional WebGIS SDK',
//     color: '#009688',
//     keywords: ['openlayers','projection','view','wms','wfs','vector','raster','render','interaction','tiles']
//   },
//   {
//     name: '核密度估计',
//     nameEn: 'Kernel Density Estimation',
//     emoji: '🌋',
//     description: '热点分析与密度估计',
//     descriptionEn: 'Hotspot density estimation',
//     color: '#C2185B',
//     keywords: ['kde','density','hotspot','smoothing','bandwidth','gaussian','surface','probability','map','analysis']
//   },
//   {
//     name: '空气质量建模',
//     nameEn: 'Air Quality Modeling',
//     emoji: '🌫️',
//     description: '空气污染与暴露模拟',
//     descriptionEn: 'Air pollution modeling',
//     color: '#607D8B',
//     keywords: ['air','pm25','pollution','exposure','dispersion','monitoring','modeling','health','urban','mapping']
//   },
//   {
//     name: '水文与流域建模',
//     nameEn: 'Hydrology & Watershed Modeling',
//     emoji: '💧',
//     description: '流域与径流模拟',
//     descriptionEn: 'Hydrology and watershed modeling',
//     color: '#00BCD4',
//     keywords: ['hydrology','runoff','streamflow','watershed','flood','routing','discharge','groundwater','model','simulation']
//   },
//   {
//     name: '气候建模与分析',
//     nameEn: 'Climate Modeling & Analysis',
//     emoji: '🌍🌡️',
//     description: '气候变化模拟与评估',
//     descriptionEn: 'Climate modeling and analysis',
//     color: '#FF5722',
//     keywords: ['climate','cmip','scenario','projection','trend','variability','downscaling','dataset','model','analysis']
//   },
//   {
//     name: '天气预报与短临',
//     nameEn: 'Weather Forecasting & Nowcasting',
//     emoji: '🌦️',
//     description: '天气监测与预测',
//     descriptionEn: 'Weather prediction and monitoring',
//     color: '#42A5F5',
//     keywords: ['weather','forecast','nowcasting','radar','satellite','storm','wind','humidity','prediction','monitoring']
//   },
//   {
//     name: 'Qt 桌面应用',
//     nameEn: 'Qt GUI Applications',
//     emoji: '🖱️',
//     description: '跨平台桌面界面开发',
//     descriptionEn: 'Cross-platform GUI development',
//     color: '#009688',
//     keywords: ['qt','gui','widgets','qml','desktop','app','pyside','pyqt','layout','designer']
//   },
//   {
//     name: '地理探测器',
//     nameEn: 'GeoDetector Models',
//     emoji: '🧭📊',
//     description: '空间异质性驱动检测',
//     descriptionEn: 'Spatial heterogeneity detection',
//     color: '#795548',
//     keywords: ['geodetector','heterogeneity','interaction','driver','risk','zoning','pattern','variance','analysis','mapping']
//   },
//   {
//     name: '克里金插值',
//     nameEn: 'Kriging Spatial Interpolation',
//     emoji: '🗺️📈',
//     description: '地统计插值分析',
//     descriptionEn: 'Geostatistical interpolation',
//     color: '#8BC34A',
//     keywords: ['kriging','interpolation','variogram','prediction','surface','geostatistics','grid','fit','model','error']
//   },
//   {
//     name: '交通建模与分析',
//     nameEn: 'Traffic Modeling & Analysis',
//     emoji: '🚗📉',
//     description: '交通流量与拥堵分析',
//     descriptionEn: 'Traffic and mobility modeling',
//     color: '#FF9800',
//     keywords: ['traffic','flow','congestion','mobility','gps','trajectory','network','assignment','transport','demand']
//   },
//   {
//     name: '地理加权回归',
//     nameEn: 'Geographically Weighted Regression',
//     emoji: '🧮🌏',
//     description: '空间异质性回归模型',
//     descriptionEn: 'Spatial regression with heterogeneity',
//     color: '#673AB7',
//     keywords: ['gwr','regression','local','spatial','kernel','bandwidth','diagnostics','residual','predict','mapping']
//   },
//   {
//     name: 'AERMOD 扩散模型',
//     nameEn: 'AERMOD Dispersion Modeling',
//     emoji: '🌬️',
//     description: '污染扩散模拟',
//     descriptionEn: 'Regulatory dispersion modeling',
//     color: '#9E9E9E',
//     keywords: ['aermod','dispersion','plume','emission','receptor','terrain','regulatory','simulation','compliance','air']
//   },
//   {
//     name: 'WRF 数值模式',
//     nameEn: 'WRF Atmospheric Modeling',
//     emoji: '☁️',
//     description: '区域数值天气模式',
//     descriptionEn: 'WRF atmospheric modeling',
//     color: '#5C6BC0',
//     keywords: ['wrf','mesoscale','forecast','physics','assimilation','domain','nesting','simulation','climate','reanalysis']
//   },
//   {
//     name: 'Web 开发',
//     nameEn: 'Web Development',
//     emoji: '🌐',
//     description: '前端、后端、全栈 Web 应用和框架',
//     descriptionEn: 'Frontend, backend, full-stack web applications and frameworks',
//     color: '#42b883',
//     keywords: ['web', 'frontend', 'backend', 'react', 'vue', 'angular', 'svelte', 'next', 'nuxt', 'express', 'koa', 'fastify', 'nestjs']
//   },
//   {
//     name: '移动开发',
//     nameEn: 'Mobile Development',
//     emoji: '📱',
//     description: 'iOS、Android、跨平台移动应用',
//     descriptionEn: 'iOS, Android, cross-platform mobile applications',
//     color: '#34a853',
//     keywords: ['mobile', 'android', 'ios', 'react-native', 'flutter', 'swift', 'kotlin', 'xamarin']
//   },
//   {
//     name: '数据科学',
//     nameEn: 'Data Science',
//     emoji: '🤖',
//     description: '机器学习、深度学习、数据分析',
//     descriptionEn: 'Machine learning, deep learning, data analytics',
//     color: '#ff9800',
//     keywords: ['machine-learning', 'ml', 'ai', 'deep-learning', 'tensorflow', 'pytorch', 'pandas', 'numpy', 'data', 'analytics']
//   },
//   {
//     name: '工具库',
//     nameEn: 'Tools & Libraries',
//     emoji: '🛠️',
//     description: '通用工具、库、框架',
//     descriptionEn: 'General tools, libraries, frameworks',
//     color: '#9c27b0',
//     keywords: ['library', 'framework', 'util', 'helper', 'tool', 'sdk', 'api']
//   },
//   {
//     name: '数据库',
//     nameEn: 'Database',
//     emoji: '💾',
//     description: '数据库系统、ORM、数据存储',
//     descriptionEn: 'Database systems, ORM, data storage',
//     color: '#ff5722',
//     keywords: ['database', 'sql', 'nosql', 'mongodb', 'postgres', 'mysql', 'redis', 'orm', 'prisma']
//   },
//   {
//     name: 'Awesome',
//     nameEn: 'Awesome',
//     emoji: '😎',
//     description: '精选资源列表',
//     descriptionEn: 'Curated resource lists',
//     color: '#ff6b6b',
//     keywords: ['awesome', 'curated', 'list', 'resources', 'collection']
//   }
  
// ];


export const DEFAULT_CATEGORIES: CategoryPreset[] = [
  {
    name: '文戏 · 配音字幕',
    nameEn: 'Civil: Voice & Subtitles',
    emoji: '🎙️',
    description: 'AI 语音合成(TTS)、情感配音、口癖切除与双层字幕打轴',
    descriptionEn: 'TTS, emotional voice acting, pause removal & dual-layer subtitles',
    color: '#36cfc9',
    keywords: ['tts', 'voice', 'speech', 'subtitles', 'whisper', 'sensevoice', 'cosyvoice', 'chattts', 'audio', 'srt', 'cutcli']
  },
  {
    name: '武戏 · 运镜视效',
    nameEn: 'Action: Camera & VFX',
    emoji: '💥',
    description: 'AI 视频生成、运镜控制、受力碰撞、粒子解构与冲击波视效',
    descriptionEn: 'AI video generation, camera motion, physics & action VFX',
    color: '#f5222d',
    keywords: ['video-generation', 'video', 'kling', 'wan', 'cogvideo', 'hunyuanvideo', 'comfyui', 'camera', 'vfx', 'motion', 'seedance']
  },
  {
    name: '视觉 · 角色锁脸',
    nameEn: 'Visual: Face Consistency',
    emoji: '🎭',
    description: '角色面部一致性、三视图骨相锁定、姿态控制与生图模型',
    descriptionEn: 'Character facial consistency, multi-view lock & portrait models',
    color: '#722ed1',
    keywords: ['instantid', 'faceid', 'lora', 'flux', 'character', 'consistency', 'portrait', 'ip-adapter', 'photomaker']
  },
  {
    name: '后期 · 剪辑工程',
    nameEn: 'Post-Production: Editing',
    emoji: '✂️',
    description: '剪映草稿自动构建、FFmpeg 硬件编解码、多轨时间线与卡点成片',
    descriptionEn: 'Automated CapCut drafts, FFmpeg hardware encoding & timeline assembly',
    color: '#fa8c16',
    keywords: ['cutcli', 'ffmpeg', 'capcut', 'draft', 'jianying', 'timeline', 'montage', 'video-editing', 'render']
  },
  {
    name: '设定 · 灵感世界观',
    nameEn: 'World-Building & Lore',
    emoji: '📜',
    description: '短剧大纲、科学修仙设定、长篇网文外挂、情节钩子与故事图谱',
    descriptionEn: 'Short drama outlines, sci-fi cultivation lore, hooks & plot graph',
    color: '#1890ff',
    keywords: ['story', 'drama', 'screenplay', 'prompt', 'world-building', 'lore', 'fiction', 'novel', 'script', 'graphify']
  },
  {
    name: 'Web 开发',
    nameEn: 'Web Development',
    emoji: '🌐',
    description: '前端、后端、全栈 Web 应用和框架',
    descriptionEn: 'Frontend, backend, full-stack web applications and frameworks',
    color: '#42b883',
    keywords: ['web', 'frontend', 'backend', 'react', 'vue', 'angular', 'svelte', 'next', 'nuxt', 'express', 'koa', 'fastify', 'nestjs']
  },
  {
    name: '移动开发',
    nameEn: 'Mobile Development',
    emoji: '📱',
    description: 'iOS、Android、跨平台移动应用',
    descriptionEn: 'iOS, Android, cross-platform mobile applications',
    color: '#34a853',
    keywords: ['mobile', 'android', 'ios', 'react-native', 'flutter', 'swift', 'kotlin', 'xamarin']
  },
  {
    name: '数据科学',
    nameEn: 'Data Science',
    emoji: '🤖',
    description: '机器学习、深度学习、数据分析',
    descriptionEn: 'Machine learning, deep learning, data analytics',
    color: '#ff9800',
    keywords: ['machine-learning', 'ml', 'ai', 'deep-learning', 'tensorflow', 'pytorch', 'pandas', 'numpy', 'data', 'analytics']
  },
  {
    name: '工具库',
    nameEn: 'Tools & Libraries',
    emoji: '🛠️',
    description: '通用工具、库、框架',
    descriptionEn: 'General tools, libraries, frameworks',
    color: '#9c27b0',
    keywords: ['library', 'framework', 'util', 'helper', 'tool', 'sdk', 'api']
  },
  {
    name: 'DevOps',
    nameEn: 'DevOps',
    emoji: '⚙️',
    description: 'CI/CD、容器化、基础设施',
    descriptionEn: 'CI/CD, containerization, infrastructure',
    color: '#00bcd4',
    keywords: ['devops', 'docker', 'kubernetes', 'k8s', 'ci', 'cd', 'deploy', 'infrastructure', 'terraform', 'ansible']
  },
  {
    name: '游戏开发',
    nameEn: 'Game Development',
    emoji: '🎮',
    description: '游戏引擎、游戏相关工具',
    descriptionEn: 'Game engines, game-related tools',
    color: '#f44336',
    keywords: ['game', 'gaming', 'unity', 'unreal', 'godot', 'phaser', 'cocos']
  },
  {
    name: '数据库',
    nameEn: 'Database',
    emoji: '💾',
    description: '数据库系统、ORM、数据存储',
    descriptionEn: 'Database systems, ORM, data storage',
    color: '#ff5722',
    keywords: ['database', 'sql', 'nosql', 'mongodb', 'postgres', 'mysql', 'redis', 'orm', 'prisma']
  },
  {
    name: '安全',
    nameEn: 'Security',
    emoji: '🔒',
    description: '网络安全、加密、认证',
    descriptionEn: 'Network security, encryption, authentication',
    color: '#e91e63',
    keywords: ['security', 'crypto', 'encryption', 'auth', 'oauth', 'jwt', 'vulnerability']
  },
  {
    name: '区块链',
    nameEn: 'Blockchain',
    emoji: '⛓️',
    description: '加密货币、智能合约、Web3',
    descriptionEn: 'Cryptocurrency, smart contracts, Web3',
    color: '#ffc107',
    keywords: ['blockchain', 'crypto', 'bitcoin', 'ethereum', 'web3', 'smart-contract', 'defi', 'nft']
  },
  {
    name: '编程语言',
    nameEn: 'Programming Language',
    emoji: '💻',
    description: '编译器、解释器、语言工具',
    descriptionEn: 'Compilers, interpreters, language tools',
    color: '#3f51b5',
    keywords: ['compiler', 'interpreter', 'language', 'parser', 'transpiler', 'babel']
  },
  {
    name: '系统编程',
    nameEn: 'Systems Programming',
    emoji: '⚡',
    description: '操作系统、底层开发',
    descriptionEn: 'Operating systems, low-level development',
    color: '#607d8b',
    keywords: ['system', 'os', 'kernel', 'driver', 'embedded', 'low-level', 'c', 'rust', 'assembly']
  },
  {
    name: '设计',
    nameEn: 'Design',
    emoji: '🎨',
    description: 'UI/UX、设计工具、图形处理',
    descriptionEn: 'UI/UX, design tools, graphics processing',
    color: '#e91e63',
    keywords: ['design', 'ui', 'ux', 'figma', 'sketch', 'graphics', 'animation', 'svg']
  },
  {
    name: '文档',
    nameEn: 'Documentation',
    emoji: '📚',
    description: '文档生成、知识管理',
    descriptionEn: 'Documentation generation, knowledge management',
    color: '#795548',
    keywords: ['documentation', 'docs', 'markdown', 'wiki', 'knowledge', 'readme']
  },
  {
    name: '测试',
    nameEn: 'Testing',
    emoji: '🧪',
    description: '测试框架、自动化测试',
    descriptionEn: 'Testing frameworks, automated testing',
    color: '#4caf50',
    keywords: ['test', 'testing', 'jest', 'mocha', 'cypress', 'selenium', 'automation', 'e2e']
  },
  {
    name: 'Awesome',
    nameEn: 'Awesome',
    emoji: '😎',
    description: '精选资源列表',
    descriptionEn: 'Curated resource lists',
    color: '#ff6b6b',
    keywords: ['awesome', 'curated', 'list', 'resources', 'collection']
  },
  {
    name: 'Node.js',
    nameEn: 'Node.js',
    emoji: '🟢',
    description: 'Node.js 生态系统',
    descriptionEn: 'Node.js ecosystem',
    color: '#339933',
    keywords: ['nodejs', 'node', 'npm', 'javascript', 'server']
  },
  {
    name: 'Vue',
    nameEn: 'Vue',
    emoji: '🟩',
    description: 'Vue 生态系统',
    descriptionEn: 'Vue ecosystem',
    color: '#42b883',
    keywords: ['vue', 'vuejs', 'composition-api', 'vuex', 'pinia', 'vite', 'nuxt']
  },
  {
    name: '其他',
    nameEn: 'Others',
    emoji: '📦',
    description: '不属于以上任何类别',
    descriptionEn: 'Not belonging to any of the above categories',
    color: '#9e9e9e',
    keywords: []
  }
]

// 从 localStorage 获取用户自定义的预设分类
export function getCategoryPresets(): CategoryPreset[] {
  const stored = localStorage.getItem('category_presets')
  if (stored) {
    try {
      return JSON.parse(stored)
    } catch (e) {
      console.error('Failed to parse category presets:', e)
    }
  }
  return [...DEFAULT_CATEGORIES]
}

// 保存预设分类到 localStorage
export function saveCategoryPresets(presets: CategoryPreset[]): void {
  localStorage.setItem('category_presets', JSON.stringify(presets))
}

// 重置为默认预设
export function resetCategoryPresets(): void {
  localStorage.removeItem('category_presets')
}

// 添加预设分类
export function addCategoryPreset(preset: CategoryPreset): void {
  const presets = getCategoryPresets()
  presets.push(preset)
  saveCategoryPresets(presets)
}

// 删除预设分类
export function removeCategoryPreset(name: string): void {
  const presets = getCategoryPresets()
  const filtered = presets.filter(p => p.name !== name)
  saveCategoryPresets(filtered)
}

// 更新预设分类
export function updateCategoryPreset(oldName: string, newPreset: CategoryPreset): void {
  const presets = getCategoryPresets()
  const index = presets.findIndex(p => p.name === oldName)
  if (index !== -1) {
    presets[index] = newPreset
    saveCategoryPresets(presets)
  }
}

