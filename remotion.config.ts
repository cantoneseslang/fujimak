import { Config } from '@remotion/cli/config';

Config.setEntryPoint('./remotion/index.ts');
Config.setPublicDir('./public');
// Required for @remotion/three WebGL in headless render (Chrome Headless Shell)
Config.setChromiumOpenGlRenderer('angle');
