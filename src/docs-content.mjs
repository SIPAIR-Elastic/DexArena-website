import {releasePages} from './docs-release.mjs';
import {referencePages} from './docs-reference.mjs';
import {trainingPage} from './docs-training.mjs';
import {evaluationPage} from './docs-evaluation.mjs';

// One source per article: navigation, search and the public build share this list.
export const documentationPages = [...releasePages, trainingPage, evaluationPage, ...referencePages];
