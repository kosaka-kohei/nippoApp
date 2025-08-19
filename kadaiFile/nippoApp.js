(function () {
    'use strict';

    /**
     * レコード新規・編集 表示イベント
     *  ・日報一括登録レコードIDフィールドの編集不可制御
     */
    kintone.events.on([
        'app.record.create.show',
        'app.record.edit.show',
    ], function (event) {

        // 日報一括登録レコードIDフィールドを非活性にする
        event.record.日報一括登録レコードID.disabled = true;

        // 合計時間フィールドを非活性にする
        event.record.合計時間.disabled = true;

        return event;

    });

    /**
     * レコード保存イベント
     *  ・フィールドの編
     */
    kintone.events.on([
        'app.record.index.change.作業時間_分',
        'app.record.create.change.作業時間_分',
        'app.record.edit.change.作業時間_分',
    ], function (event) {
        let record = event.record;
        let totalTime = 0;
        // 分単位での合計時間を集計
        record.報告内容.value.forEach(element => {
            totalTime += Number(element.value.作業時間_分.value);
        });
        // 合計時間を60で割ることで分単位から時間単位に変換
        record.合計時間.value = totalTime / 60;
        return event;

    })

    /**
     * 画面(新規、編集、一覧編集)保存イベント
     *  ・担当者フィールドに複数人入力られていると入力エラー表示
     */
    kintone.events.on([
        'app.record.create.submit',
        'app.record.index.edit.submit',
        'app.record.edit.submit',
    ], async function (event) {
        let record = event.record;
        let tantoshaMei = record.担当者.value;
        // 担当者が一人以上いるかを確認。
        if (tantoshaMei.length > 1) {
            record.担当者.error = "担当者が複数人います";  // 担当者が複数人存在するとき,エラーを表示
        }

        let nyuryokuKaisu = record.報告内容.value.length;
        // それぞれの報告内容で一つでも0以下の作業時間がエラーを表示
        for (let i = 0; i < nyuryokuKaisu; i++) {
            let sagyoJikan = record.報告内容.value[i].value.作業時間_分.value;
            if (sagyoJikan <= 0) {
                record.報告内容.value[i].value.作業時間_分.error = "作業時間を正しく入力してください";
                break;
            }
        }

        let gokeiJikan = 0;
        // レコードに登録された合計時間の回数を数える
        let torokuKaisu = record.報告内容.value.length;

        // レコードに登録された合計時間を合計
        for (let i = 0; i <= (torokuKaisu - 1); i++) {
            gokeiJikan += record.報告内容.value[i].value.作業時間_分.value;;
        }

        // gokeiJikanが8時間以上を超えるとエラーを表示
        if (gokeiJikan > 480) {
            record.合計時間.error = "勤務時間を超過しています。";
        }

        const tantoshaCode = record.担当者.value[0].code;
        const sagyobi = record.作業日.value;
        const recordId = kintone.app.record.getId();
        console.log(recordId); // デバック用
        let Data = '';
        try {
            // 編集画面(レコードIDが存在する)の場合
            if (recordId != null) {
                Data = await kintone.api(kintone.api.url('/k/v1/records.json', true), 'GET', {
                    'app': kintone.app.getId(),
                    // 現在編集中のレコードは条件から外す
                    'query': '担当者 in ("' + tantoshaCode + '") and 作業日 = "' + sagyobi + '" and $id = "' + recordId + '"',
                    'fields': ['担当者', '作業日']
                });
            }
            // 新規画面(レコードIDが存在しない)の場合
            else {
                Data = await kintone.api(kintone.api.url('/k/v1/records.json', true), 'GET', {
                    'app': kintone.app.getId(),
                    // 新規登録画面の時、単に担当者と作業日がかぶるかどうかを確認
                    'query': '担当者 in ("' + tantoshaCode + '") and 作業日 = "' + sagyobi + '"',
                    'fields': ['担当者', '作業日']
                });
            }
            console.log(Data);  //デバック用

            // 担当者、作業日が同じものが既に登録されている場合、エラー表示
            if (Data.records.length > 0) {
                record.担当者.error = "入力情報が重複しています";
            }
        } catch (err) {
            console.log(err);
        }

        return event;

    })
})()
