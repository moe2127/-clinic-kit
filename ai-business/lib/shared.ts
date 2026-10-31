export const industries=['鍼灸院','整骨院','整体院','リラクゼーションサロン'] as const;
export const plans=['light','standard','premium'] as const;
export type Plan=typeof plans[number];
export const planNames={light:'ライト',standard:'スタンダード',premium:'プレミアム'};

export const revisionFocuses=['広告表現を控えめに','重複を減らす','誤字と読みやすさを見直す','使い方を詳しくする'] as const;
