import { GoogleGenAI, Type, Modality } from "@google/genai";
import type { FullScript, Character } from '../types';
import type { ContinuationType, StoryFormat } from "../App";

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable is not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const scriptSchema = {
  type: Type.OBJECT,
  properties: {
    characters: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          description: { type: Type.STRING },
        },
        required: ["name", "description"]
      },
    },
    panels: {
      type: Type.ARRAY,
      description: "반드시 4개의 패널로 구성된 배열이어야 합니다.",
      minItems: 4,
      maxItems: 4,
      items: {
        type: Type.OBJECT,
        properties: {
          panel: { type: Type.NUMBER },
          character: { type: Type.STRING },
          description: { type: Type.STRING },
          dialogue: { type: Type.STRING },
        },
        required: ["panel", "character", "description", "dialogue"],
      },
    },
  },
  required: ["characters", "panels"],
};

const ideasSchema = {
  type: Type.OBJECT,
  properties: {
    ideas: {
      type: Type.ARRAY,
      description: "반드시 5개의 아이디어로 구성된 배열이어야 합니다.",
      minItems: 5,
      maxItems: 5,
      items: {
        type: Type.STRING,
        description: "만화 주제 아이디어"
      }
    }
  },
  required: ["ideas"]
};

const instagramPostSchema = {
  type: Type.OBJECT,
  properties: {
    description: {
      type: Type.STRING,
      description: "인스타그램 게시물을 위한 감성적이고 매력적인 설명글. 이모지를 적절히 사용해주세요."
    },
    hashtags: {
      type: Type.STRING,
      description: "해시 기호(#)로 시작하고 공백으로 구분된 관련 해시태그 문자열. (예: #일상툰 #인스타툰 #공감툰)"
    },
  },
  required: ["description", "hashtags"],
};


function getIdeasPrompt(category: string): string {
  return `
  당신은 창의적인 4컷 만화 아이디어 제안 전문가입니다.
  선택된 카테고리인 **'${category}'**에 딱 맞는, 독자들의 흥미를 끌 만한 구체적이고 재미있는 4컷 만화 주제 **5개**를 추천해주세요.

  # 규칙
  1. 각 아이디어는 한 문장으로 간결하게 표현해야 합니다.
  2. 독자의 호기심을 자극할 수 있는 창의적인 아이디어를 제안해야 합니다.
  3. JSON 형식으로만 응답해야 합니다.
  
  예시:
  - '일상 공감 및 개그 만화' 카테고리: "배달 앱 최소주문금액을 채우려다 냉장고가 터지기 직전인 자취생의 이야기"
  - '가상 역사/SF 만화' 카테고리: "조선시대의 한 과학자가 사실 타임머신을 발명했다면?"
  `;
}

export async function generateIdeas(category: string): Promise<string[]> {
  const prompt = getIdeasPrompt(category);

  const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
          responseMimeType: 'application/json',
          responseSchema: ideasSchema,
      },
  });

  const jsonText = response.text.trim();
  try {
      const parsed = JSON.parse(jsonText) as { ideas: string[] };
      return parsed.ideas;
  } catch (e) {
      console.error("Failed to parse ideas JSON:", jsonText);
      throw new Error("AI가 유효하지 않은 형식의 아이디어를 생성했습니다.");
  }
}

function getScriptPrompt(topic: string, category: string, storyFormat: StoryFormat): string {
  const baseRules = `
    # 규칙
    1.  **매우 중요**: 만약 아래 '주제'에 이미 구체적인 캐릭터 이름과 대사가 포함된 대본 형식이 있다면, **반드시 그 캐릭터 이름과 대사를 그대로 사용해야 합니다.** 이 경우 당신의 역할은 주어진 대사에 어울리는 각 컷의 시각적 묘사('description')를 창의적으로 작성하는 것입니다. '주제'가 일반적인 아이디어일 경우에만 캐릭터와 대사를 처음부터 창작해주세요.
    2.  캐릭터는 2~3명을 넘지 않아야 합니다. 각 캐릭터의 이름과 간단한 외형/성격 묘사를 포함해주세요.
    3.  캐릭터 이름은 'A대리'처럼 평범한 이름 대신, 캐릭터의 성격이나 특징을 살린 익살스러운 이름으로 지어주세요. (단, 1번 규칙에 따라 대본이 주어진 경우는 예외)
    4.  캐릭터 묘사는 머리 스타일, 의상 색상, 주요 특징 등 시각적으로 구별되는 요소를 구체적으로 포함하여 이미지 생성 시 일관성을 유지하기 쉽게 만들어주세요.
    5.  각 컷(패널)별로 다음 정보를 명확하게 구분하여 제공해야 합니다:
        *   **panel**: 컷 번호 (1-4)
        *   **character**: 해당 컷에서 말하는 캐릭터의 이름. 대사가 없으면 '없음'.
        *   **description**: 해당 컷의 배경, 캐릭터의 표정, 행동, 구도에 대한 시각적 묘사. 이미지 생성을 위한 프롬프트로 사용될 것이므로 구체적으로 작성해주세요.
        *   **dialogue**: 캐릭터의 대사.
    6.  주제: "${topic}"
    7.  JSON 형식으로만 응답해주세요.
  `;

  let storyFormatInstruction = '';
  if (storyFormat === 'serial') {
    storyFormatInstruction = `
    # 시리즈 형식 규칙
    이 4컷 만화는 앞으로 계속 이어질 시리즈의 **첫 화**입니다. 
    이야기를 시작하되, 마지막 컷은 독자들이 다음 화를 궁금해할 만한 **여지를 남기거나, 새로운 사건을 암시하며 마무리**해주세요. 완결된 느낌을 주어서는 안 됩니다.
    `;
  }

  let specificInstructions = '';

  switch (category) {
    case '사용자 주제에 따름':
      specificInstructions = `
        당신은 주어진 '주제'를 가장 잘 표현할 수 있는 4컷 만화 작가입니다. 
        주제의 핵심 내용과 분위기를 정확히 파악하여, 그에 가장 적합한 스타일의 4컷 만화 대본을 작성해주세요. 
        장르에 구애받지 말고, 오직 '주제'에만 집중하여 창의력을 발휘해주세요.
      `;
      break;
    case '일상 공감 및 개그 만화':
      specificInstructions = `
        당신은 유머러스하고 재치있는 4컷 만화 작가입니다. 주어진 주제에 대해 독자들이 '내 얘기잖아!'하며 무릎을 탁 치게 만드는 **일상 공감 개그** 만화 대본을 작성해주세요.
        # 추가 규칙
        1. 전체적인 분위기는 밝고 경쾌해야 합니다.
        2. 마지막 컷은 웃음을 유발하는 반전이나 공감의 극대화로 마무리해주세요.
        3. 따뜻하고 코믹한 '명랑만화' 스타일을 지향합니다.
      `;
      break;
    case '반려동물':
      specificInstructions = `
        당신은 반려동물과의 일상을 따뜻하게 그리는 4컷 만화 작가입니다. 주어진 주제에 대해 독자들이 미소 짓게 만드는 **사랑스럽고 공감 가는 반려동물** 만화 대본을 작성해주세요.
        # 추가 규칙
        1. 사람과 동물의 교감을 중심으로 이야기를 풀어주세요.
        2. 동물의 시점에서 생각하는 독백을 넣으면 재미를 더할 수 있습니다.
        3. 마지막 컷은 따뜻한 감동이나 귀여운 반전으로 마무리해주세요.
      `;
      break;
    case '감동실화':
      specificInstructions = `
        당신은 감동적인 실화를 바탕으로 독자들의 마음을 울리는 4컷 만화 작가입니다. 주어진 주제에 대해 독자들이 깊은 감동과 여운을 느낄 수 있는 **감동 실화** 만화 대본을 작성해주세요.
        # 추가 규칙
        1. 이야기는 실화이거나 실화에 기반한 것처럼 현실적이고 진정성 있게 구성해주세요.
        2. 등장인물들의 감정 변화를 섬세하게 묘사해주세요.
        3. 마지막 컷은 독자에게 깊은 감동이나 따뜻한 교훈을 주며 마무리해주세요.
      `;
      break;
    case '자기계발(자신감상승)':
      specificInstructions = `
        당신은 긍정적인 메시지를 전하는 4컷 만화 작가입니다. 주어진 주제에 대해 독자들의 **자존감을 높이고 자신감을 불어넣어 주는** 힐링 만화 대본을 작성해주세요.
        # 추가 규칙
        1. 소심하거나 자신감 없는 캐릭터가 작은 성공을 통해 변화하는 모습을 보여주세요.
        2. 부정적인 상황을 긍정적으로 해석하는 관점의 전환을 제시해주세요.
        3. 마지막 컷은 독자에게 용기를 주는 따뜻한 응원의 메시지나 실천 가능한 작은 팁으로 마무리해주세요.
      `;
      break;
    case '캠페인':
      specificInstructions = `
        당신은 사회적 메시지를 효과적으로 전달하는 4컷 캠페인 만화 작가입니다. 주어진 주제에 대해 독자들의 인식 개선이나 행동 변화를 유도하는 **긍정적이고 설득력 있는** 4컷 만화 대본을 작성해주세요.
        # 추가 규칙
        1. 메시지는 명확하고 이해하기 쉬워야 합니다.
        2. 부정적이거나 공격적인 표현 대신, 긍정적인 대안이나 희망적인 메시지를 담아주세요.
        3. 마지막 컷은 캠페인의 핵심 메시지나 행동 촉구를 상기시키며 마무리해주세요.
      `;
      break;
    case '매뉴얼':
      specificInstructions = `
        당신은 복잡한 정보도 쉽고 재미있게 설명하는 4컷 매뉴얼 만화 작가입니다. 주어진 주제에 대해 독자들이 순서대로 따라 할 수 있는 **명확하고 친절한 4컷짜리 사용 설명서**를 작성해주세요.
        # 추가 규칙
        1. 각 컷은 하나의 단계를 명확하게 보여줘야 합니다. (1단계 -> 2단계 -> 3단계 -> 완료/결과)
        2. 설명은 간결하고 직접적인 표현을 사용해주세요.
        3. 캐릭터는 가르쳐주는 '전문가'와 배우는 '초보자' 구도로 설정하면 좋습니다.
      `;
      break;
    case '가상 역사/SF 만화':
      specificInstructions = `
        당신은 상상력이 풍부한 SF/판타지 4컷 만화 작가입니다. 주어진 주제를 바탕으로 **기발한 상상력이 돋보이는 가상 역사 또는 SF** 4컷 만화 대본을 작성해주세요.
        # 추가 규칙
        1. 세계관이나 설정에 대한 암시를 통해 독자의 흥미를 유발해주세요.
        2. 마지막 컷은 놀라운 반전, 새로운 미스터리 제시, 또는 세계관의 핵심을 보여주는 장면으로 마무리하여 여운을 남겨주세요.
        3. 캐릭터 디자인과 배경 묘사에 SF 또는 판타지 장르의 특징이 드러나도록 구체적으로 서술해주세요.
      `;
      break;
    case '개념 설명 및 원리 소개':
      specificInstructions = `
        당신은 어려운 개념을 그림으로 쉽게 풀어내는 과학/교육 만화 작가입니다. 주어진 주제(개념)에 대해 비유나 예시를 사용하여 **핵심 원리를 4컷 안에 명확하게 설명**하는 만화 대본을 작성해주세요.
        # 추가 규칙
        1. 첫 컷에서는 질문이나 흥미로운 현상을 제시합니다.
        2. 중간 컷들에서 단계적으로 원리를 설명합니다.
        3. 마지막 컷은 이해를 돕는 요약이나 실생활 적용 예시로 마무리합니다.
        4. 캐릭터는 질문하는 '학생'과 설명하는 '선생님' 또는 '박사님' 구도가 효과적입니다.
      `;
      break;
    case '언어 학습':
        specificInstructions = `
        당신은 외국어 교육용 콘텐츠를 만드는 4컷 만화 작가입니다. 주어진 주제(상황)에서 유용하게 쓰일 **핵심 표현(단어 또는 문장) 하나를 가르쳐주는** 4컷 만화 대본을 작성해주세요.
        # 추가 규칙
        1. 1~3컷에서는 핵심 표현이 사용되는 자연스러운 대화 상황을 보여줍니다.
        2. 마지막 컷에서는 캐릭터가 해당 표현의 의미나 뉘앙스를 간단히 설명해주거나, 다른 예시를 보여주며 마무리합니다.
        3. 학습할 표현이 명확히 드러나도록 구성해주세요.
        4. 캐릭터 묘사 시 '한국어를 배우는 외국인', '외국인 친구를 둔 한국인' 등의 설정을 활용하면 좋습니다.
      `;
      break;
    case '시사 풍자 만화':
    default:
      specificInstructions = `
        당신은 시니컬하고 풍자적인 4컷 만화 시나리오 작가입니다. **당신은 웹 검색 능력이 있습니다.**
        주어진 주제 **"${topic}"** 와 관련하여 **최신 사회 이슈나 뉴스를 웹 검색으로 찾아보고**, 그 내용을 바탕으로 냉소적인 시각을 담은 4컷 만화 대본을 작성해주세요. 마지막 컷에서는 독자의 허를 찌르는 **'뼈 때리는 한 방(punchline)'**이 반드시 포함되어야 합니다.
        # 추가 규칙
        1.  전체적인 분위기는 1990년대 후반 ~ 2000년대 초반의 일상 코믹 애니메이션 스타일 (예: '명랑만화') 이어야 합니다.
        2.  **매우 중요**: 마지막 컷의 대사는 전체 내용의 핵심을 찌르는 강력하고 냉소적인 펀치라인이어야 합니다.
      `;
      break;
  }
  return specificInstructions + storyFormatInstruction + baseRules;
}


export async function generateScript(topic: string, category: string, storyFormat: StoryFormat): Promise<FullScript> {
  const prompt = getScriptPrompt(topic, category, storyFormat);
  const isSatire = category === '시사 풍자 만화';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const config: any = {};

  if (isSatire) {
    config.tools = [{googleSearch: {}}];
  } else {
    config.responseMimeType = 'application/json';
    config.responseSchema = scriptSchema;
  }
  
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: config,
  });

  const jsonText = response.text.trim();
  try {
     let cleanJsonText = jsonText;
    if (jsonText.startsWith('```json')) {
        cleanJsonText = jsonText.substring(7, jsonText.length - 3).trim();
    } else if (jsonText.startsWith('```')) {
        cleanJsonText = jsonText.substring(3, jsonText.length - 3).trim();
    }
    return JSON.parse(cleanJsonText) as FullScript;
  } catch (e) {
    console.error("Failed to parse script JSON:", jsonText);
    throw new Error("AI가 유효하지 않은 형식의 대본을 생성했습니다.");
  }
}

function getInstagramPostPrompt(topic: string, script: FullScript): string {
  const scriptSummary = script.panels.map(p => `컷 ${p.panel}: ${p.description} ${p.dialogue}`).join('\n');

  return `
  당신은 인스타그램 웹툰 계정을 운영하는 소셜 미디어 마케팅 전문가입니다.
  아래 제공된 4컷 만화의 주제와 대본 요약을 바탕으로, 독자들의 참여를 유도할 수 있는 매력적인 인스타그램 게시물 설명과 해시태그를 생성해주세요.

  # 만화 정보
  - 주제: ${topic}
  - 대본 요약:
  ${scriptSummary}

  # 규칙
  1. **설명 (description)**:
     - 만화 내용과 관련된 재미있거나 공감 가는 이야기를 1~3문장으로 작성해주세요.
     - 독자들이 댓글을 달고 싶게 만드는 질문을 포함하면 좋습니다.
     - 친근하고 유머러스한 톤을 유지하고, 이모지를 1~3개 적절히 사용해주세요.
  2. **해시태그 (hashtags)**:
     - #인스타툰, #4컷만화, #일상툰 등 필수적인 해시태그를 포함해주세요.
     - 만화의 주제와 관련된 키워드를 해시태그로 만들어주세요.
     - 총 5~10개의 해시태그를 공백으로 구분된 단일 문자열로 제공해주세요. (예: #해시태그1 #해시태그2)
  3. JSON 형식으로만 응답해야 합니다.
  `;
}

export async function generateInstagramPost(topic: string, script: FullScript): Promise<{ description: string; hashtags: string; }> {
  const prompt = getInstagramPostPrompt(topic, script);

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: instagramPostSchema,
    },
  });

  const jsonText = response.text.trim();
  try {
    return JSON.parse(jsonText) as { description: string; hashtags: string; };
  } catch (e) {
    console.error("Failed to parse Instagram post JSON:", jsonText);
    throw new Error("AI가 유효하지 않은 형식의 인스타그램 포스트를 생성했습니다.");
  }
}

function getImageStylePrompt(style: string): { styleGuide: string, outputFormat: string, role: string } {
    const commonOutputFormat = `
      *   풀 컬러 디지털 일러스트레이션 (Full-color digital illustration)
      *   **가장 중요: 이미지 안에 배경 간판, 의상의 글자 등 텍스트가 필요한 경우, 반드시 영어(English)로만 작성해야 합니다. 한국어나 다른 언어는 절대로 포함해서는 안됩니다.** 또한, 특정 국가를 연상시키는 문화적 요소(의상, 건축물 등)는 피해주세요.
    `;

    switch (style) {
        case '아메리칸 코믹스':
            return {
                role: "당신은 실버 에이지(Silver Age) 시절의 클래식한 미국 슈퍼히어로 코믹스 스타일 전문가입니다.",
                styleGuide: `
                  ### **1. 캐릭터 디자인 (Character Design):**
                  * **얼굴 및 신체**: 역동적인 포즈와 각진 근육질의 체형을 강조합니다. **5~6등신** 비율을 사용합니다.
                  * **표정**: 과장되고 극적인 표정을 사용합니다.
                  
                  ### **2. 선과 색상 (Line & Color):**
                  * **선**: **강렬하고 두꺼운 검은색 잉크 외곽선**을 사용하며, 그림자 표현을 위해 **해칭과 크로스해칭**을 적극적으로 활용합니다.
                  * **색상**: **벤데이 점(Ben-Day dots)** 패턴을 활용하여 질감을 표현하고, **강렬한 원색 위주**의 색상 팔레트를 사용합니다. 복잡한 그라데이션은 피합니다.
                  
                  ### **3. 배경 및 분위기 (Background & Vibe):**
                  * **배경**: 집중선이나 효과음을 활용하여 역동성을 강조합니다.
                  * **분위기**: **극적이고, 영웅적이며, 역동적인** 느낌을 담아주세요.
                `,
                outputFormat: `
                  ${commonOutputFormat}
                  *   **절대 피해야 할 요소**: 일본 만화/애니메이션 스타일, 얇은 선, 부드러운 파스텔 톤 색상.
                `
            };
        case '한국 최신 웹툰':
            return {
                role: "당신은 세련되고 트렌디한 스타일로 유명한 한국의 인기 웹툰 작가입니다.",
                styleGuide: `
                  ### **1. 캐릭터 디자인 (Character Design):**
                  * **얼굴형**: 현대적이고 매력적인, 다양한 개성을 가진 얼굴형을 사용합니다.
                  * **눈**: 감정을 풍부하게 표현할 수 있는, **크고 디테일이 살아있는** 눈을 그립니다.
                  * **신체 비율**: **5~6등신**의 늘씬하고 스타일리시한 체형을 기본으로 합니다.
                  
                  ### **2. 선과 색상 (Line & Color):**
                  * **선**: **강약 조절이 있는 세련된** 디지털 선을 사용합니다.
                  * **색상**: **그라데이션과 셀 채색을 혼합**하여 입체감을 살리고, **극적인 조명 효과**를 적극적으로 사용합니다. 채도가 높고 화사한 색감을 선호합니다.
                  
                  ### **3. 배경 및 분위기 (Background & Vibe):**
                  * **배경**: 장면에 어울리는 현대적이고 디테일한 배경을 포함합니다.
                  * **분위기**: **트렌디하고, 드라마틱하며, 감성적인** 느낌을 담아주세요.
                `,
                outputFormat: `
                  ${commonOutputFormat}
                  *   **절대 피해야 할 요소**: 단순한 점으로 된 눈, 2~3등신 캐릭터, 투박한 그림체.
                `
            };
        case '린 클레어 (Ligne claire)':
            return {
                role: "당신은 프랑스-벨기에의 고전적인 '라인 클레어(ligne claire)' 만화 스타일의 대가입니다. 특히 '땡땡(Tintin)' 스타일을 깊이 이해하고 있습니다.",
                styleGuide: `
                  ### **1. 캐릭터 디자인 (Character Design):**
                  * **얼굴 및 신체**: **사실적이면서도 단순화된** 인물 표현이 특징입니다. **4~5등신** 비율을 사용하며, 표정은 과장되지 않고 명확하게 전달합니다.
                  
                  ### **2. 선과 색상 (Line & Color):**
                  * **선**: **굵기가 일정한 깨끗하고 명확한** 외곽선을 사용합니다. 해칭이나 명암을 위한 선은 사용하지 않습니다.
                  * **색상**: **그라데이션이 없는 단색**으로 깔끔하게 채색합니다. 밝고 선명한 색상을 사용합니다.
                  
                  ### **3. 배경 및 분위기 (Background & Vibe):**
                  * **배경**: **매우 상세하고 현실적으로 묘사된** 배경이 특징입니다. 캐릭터와 배경의 디테일 수준이 거의 동일합니다.
                  * **분위기**: **모험적이고, 명랑하며, 사실적인** 느낌을 담아주세요.
                `,
                outputFormat: `
                  ${commonOutputFormat}
                  *   **절대 피해야 할 요소**: 일본 만화/애니메이션 스타일, 미국 코믹스 스타일의 과장된 액션, 복잡한 명암이나 그라데이션.
                `
            };
        case '명랑만화':
        default:
            return {
                role: "당신은 1990년대 후반 ~ 2000년대 초반의 일상 코믹 애니메이션 스타일을 완벽하게 재현하는 전문 애니메이터입니다. 특히 **'명랑만화'** 스타일의 특징을 깊이 이해하고 있습니다.",
                styleGuide: `
                  ### **1. 캐릭터 디자인 (Character Design):**
                  * **얼굴형**: **과장되고 단순한 도형**을 기반으로 합니다. (예: 타원, 역삼각형, 땅콩 모양 등) 완벽한 미형이 아닌, 개성 있고 우스꽝스러운 느낌을 강조합니다.
                  * **눈**: 매우 작고 단순한 **검은 점** 또는 **짧은 선**으로 표현합니다. 절대 크고 반짝이는 '모에' 스타일의 눈을 그리지 마세요.
                  * **코와 입**: 코는 생략하거나 아주 작은 선으로 표현합니다. 입은 감정 표현을 위해 **크고 과장되게** 그릴 수 있습니다. 특히 웃을 때는 입이 얼굴의 큰 부분을 차지합니다.
                  * **신체 비율**: **2~3등신의 짧고 통통한** 체형입니다. 머리가 몸에 비해 매우 큽니다.
                  
                  ### **2. 선과 색상 (Line & Color):**
                  * **선**: **깨끗하고 일정한 굵기**의 검은색 외곽선을 사용합니다.
                  * **색상**: **그라데이션이나 복잡한 명암이 없는** 완벽한 **셀 채색(Cel Shading)** 방식을 사용합니다. 파스텔 톤의 밝지만 쨍하지 않은 색감을 주로 사용합니다.
                  
                  ### **3. 배경 및 분위기 (Background & Vibe):**
                  * **배경**: 캐릭터에 집중할 수 있도록 **단색 또는 매우 단순화된** 배경을 사용합니다.
                  * **분위기**: **코믹하고, 따뜻하며, 일상적인** 느낌을 담아주세요.
                `,
                outputFormat: `
                  ${commonOutputFormat}
                  *   **절대 피해야 할 요소**: 사실적인 묘사, 8등신 비율, 복잡한 명암, 화려한 배경.
                `
            };
    }
}


export async function generateCharacterSheet(characterDescription: string, style: string): Promise<string> {
    const { role, styleGuide, outputFormat } = getImageStylePrompt(style);
    
    const fullPrompt = `
    # 역할(Role)
    ${role}
    
    # 지시(Instruction)
    아래의 **'핵심 스타일 가이드'**를 **반드시 준수**하여, 주어진 **'생성할 캐릭터 정보'**에 맞는 인물 캐릭터 1명의 **캐릭터 시트**를 생성해주세요.
    
    ---
    
    ## **핵심 스타일 가이드 (Key Style Guide)**
    ${styleGuide}
    
    ---
    
    ## **생성할 캐릭터 정보 (Input Data)**
    *   **캐릭터**: ${characterDescription}
    *   **요구사항**: 전신이 잘 보이도록, 단순한 단색 배경에 캐릭터 1명만 서 있는 포즈로 그려주세요. 다른 사물이나 복잡한 배경은 포함하지 마세요.
    
    ## **출력 형식 (Output Format)**
    ${outputFormat}
    `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: fullPrompt,
    config: {
      imageConfig: {
        aspectRatio: "1:1",
      },
    },
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return part.inlineData.data;
    }
  }

  throw new Error("캐릭터 시트 이미지를 생성하지 못했습니다.");
}

export async function generateImage(panelDescription: string, characters: Character[], style: string): Promise<string> {
    const { role, styleGuide, outputFormat } = getImageStylePrompt(style);

    const textPrompt = `
    # 역할(Role)
    ${role}

    # 지시(Instruction)
    주어진 **'캐릭터 시트 이미지'**를 **절대적으로 참조**하여, **'장면 묘사'**에 맞는 장면을 그려주세요. 캐릭터의 외모, 의상, 스타일은 반드시 캐릭터 시트와 동일해야 합니다. 일관성이 깨지면 작업은 실패한 것입니다.
    **중요**: 캐릭터 시트 이미지에 배경이 포함되어 있을 수 있습니다. 배경은 무시하고 **오직 캐릭터의 외모, 의상, 스타일 등 캐릭터 자체에만 집중**하여 장면을 그려주세요.
    
    ---
    
    ## **핵심 스타일 가이드 (Key Style Guide)**
    ${styleGuide}
    
    ---
    
    ## **생성할 장면 정보 (Input Data)**
    **장면 묘사**: ${panelDescription}
    
    ## **출력 형식 (Output Format)**
    ${outputFormat}
    **추가 규칙**: 말풍선은 절대 포함하지 마세요.
    `;

    const imageParts = characters
        .filter(c => c.sheetImage)
        .map(c => ({
            inlineData: {
                data: c.sheetImage!,
                mimeType: 'image/png',
            },
        }));

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
            parts: [
                ...imageParts,
                { text: textPrompt },
            ],
        },
        config: {
            imageConfig: {
                aspectRatio: "1:1",
            },
        },
    });
    
    for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
            return part.inlineData.data;
        }
    }

    throw new Error("이미지를 생성하지 못했습니다. (AI 응답에서 이미지를 찾을 수 없습니다)");
}

function getContinuationScriptPrompt(previousTopic: string, previousScript: FullScript, continuationTopic: string, category: string, continuationType: ContinuationType): string {
    const fullPromptTemplate = getScriptPrompt("dummy", category, 'single');
    const role = fullPromptTemplate.substring(0, fullPromptTemplate.indexOf('#')).trim();
  
    const characterDefinitions = previousScript.characters.map(c => `*   **${c.name}**: ${c.description}`).join('\n');
    const previousPanelsSummary = previousScript.panels.map(p => `컷 ${p.panel}: [${p.character}] ${p.dialogue} (${p.description})`).join('\n');
  
    const topicInstruction = continuationTopic.trim()
        ? `이번 4컷의 구체적인 주제는 다음과 같습니다: "${continuationTopic}"`
        : `이전 이야기의 흐름을 자연스럽게 이어받아, 흥미로운 다음 이야기를 자동으로 구상해주세요.`;

    let continuationInstruction = '';
    if (continuationType === 'end') {
        continuationInstruction = `
        # 마무리 지시
        이번 4컷은 이야기의 **완결**입니다. 모든 갈등을 해소하고 독자에게 만족스러운 결말을 선사하며 이야기를 마무리해주세요.
        `;
    } else {
        continuationInstruction = `
        # 이어가기 지시
        이번 4컷은 다음 이야기로 이어지는 **중간 다리**입니다. 현재의 사건을 진행시키되, 마지막 컷에서는 독자의 궁금증을 유발하는 새로운 사건이나 반전을 암시하며 **다음 화를 기대하게 만들어주세요.**
        `;
    }
  
    return `${role}
    # 지시
    당신은 4컷 만화의 후속편을 만드는 시나리오 작가입니다.
    아래 제공된 '기존 만화 정보'를 바탕으로, 자연스럽게 이어지는 다음 4컷의 대본을 생성해주세요.
    
    # 기존 만화 정보
    *   최초 주제: ${previousTopic}
    *   이전 4컷 요약: 
    ${previousPanelsSummary}
    *   등장인물 (매우 중요!): 아래 등장인물 설정을 **절대로 변경하지 말고 그대로 사용해야 합니다.** 새로운 인물을 추가하지 마세요.
    ${characterDefinitions}
  
    # 이번 4컷 주제
    ${topicInstruction}

    ${continuationInstruction}
  
    # 규칙
    1.  **등장인물 일관성**: 제공된 등장인물의 이름과 설정을 반드시 그대로 유지해야 합니다.
    2.  **스토리 연속성**: 이전 4컷의 마지막 장면에서 이야기가 자연스럽게 이어지도록 구성해주세요.
    3.  각 컷(패널)별로 다음 정보를 명확하게 구분하여 제공해야 합니다:
        *   panel: 컷 번호 (1-4)
        *   character: 해당 컷에서 말하는 캐릭터의 이름. 대사가 없으면 '없음'.
        *   description: 해당 컷의 배경, 캐릭터의 표정, 행동, 구도에 대한 시각적 묘사.
        *   dialogue: 캐릭터의 대사.
    4.  JSON 형식으로만 응답해주세요.
    `;
  }
  
  
  export async function generateContinuationScript(previousTopic: string, previousScript: FullScript, continuationTopic: string, category: string, continuationType: ContinuationType): Promise<FullScript> {
    const prompt = getContinuationScriptPrompt(previousTopic, previousScript, continuationTopic, category, continuationType);
  
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: scriptSchema,
        },
    });
  
    const jsonText = response.text.trim();
    try {
        return JSON.parse(jsonText) as FullScript;
    } catch (e) {
        console.error("Failed to parse continuation script JSON:", jsonText);
        throw new Error("AI가 유효하지 않은 형식의 후속 대본을 생성했습니다.");
    }
  }