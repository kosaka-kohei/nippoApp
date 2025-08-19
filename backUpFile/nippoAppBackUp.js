(function () {
    'use strict';

    /**
     * 画面（新規、編集）表示時のイベント
     *  ・合計時間フィールドの編集不可制御
     *  ・日報一括登録レコードIDフィールドの編集不可制御
     */
    kintone.events.on([
        'app.record.create.show',
        'app.record.edit.show',
        'app.record.index.edit.show',
    ], function (event) {

        // 合計時間フィールドを非活性にする
        event.record.合計時間.disabled = true;
        // 日報一括登録レコードIDフィールドを非活性にする
        event.record.日報一括登録レコードID.disabled = true;


        return event;

    })

    /**
    * 画面（新規、編集）レコード変更時のイベント
    *  ・作業時間を分から時間に変更し、合計時間フィールドに表示
    */
    kintone.events.on([
        // テーブルが追加・削除された際に処理が起きるよう'app.record.create.change.報告内容'を追加
        'app.record.create.change.作業時間_分',
        'app.record.edit.change.作業時間_分',
        'app.record.create.change.報告内容',
        'app.record.edit.change.報告内容',
    ], function (event) {
        const record = event.record;
        let totalTime = 0;
        // 報告内容テーブル内にある作業時間を合計
        record.報告内容.value.forEach(element => {
            // もし作業時間が何も入力されなかった場合、0に変換するよう修正
            if (isNaN(element.value.作業時間_分.value)) element.value.作業時間_分.value = 0;
            totalTime += Number(element.value.作業時間_分.value);
        });
        // 合計時間を60で割ることで分単位から時間単位に変換
        let val = totalTime / 60;
        // 小数点2以下まで出力するように修正
        record.合計時間.value = Math.floor(val * 100) / 100;
        return event;
    })

    /**
     * 画面（新規、編集、一覧編集）保存時のイベント
     *  ・「担当者」が複数人入力されている場合は入力エラーを表示する
     *  ・「報告内容」テーブルの「作業時間（分）」の値が「0以下」の場合は入力エラーを表示する
     *  ・「合計時間」の値が8時間を超えている場合は勤務時間超過エラーを表示する
     *  ・登録されている日報の中に、「担当者」と「作業日」の組合せが同じレコードが存在する場合は重複エラーを表示する
     */
    kintone.events.on([
        'app.record.create.submit',
        'app.record.index.edit.submit',
        'app.record.edit.submit',
    ], async function (event) {
        const record = event.record;
        const tantoshaMei = record.担当者.value;
        const sagyobi = record.作業日.value;
        // エラー判別。trueになるとエラーが発生
        let hasError = false;

        // 担当者が入力されていないとき
        if (tantoshaMei.length == 0) {
            hasError = true;
        }

        // 作業日が入力されていないとき
        if (!sagyobi) {
            hasError = true;
        }

        // プロジェクトコードが入力されていないとき
        for (let i = 0; i < record.報告内容.value.length; i++) {
            if (record.報告内容.value[i].value.プロジェクトコード.value === undefined) {
                hasError = true;
            }
        }

        // もし未入力がどこかで発生していればreturn
        if (hasError) return event;

        // 担当者が一人以上いるかを確認。
        if (tantoshaMei.length > 1) {
            // 担当者が複数人存在するとき,エラーを表示
            record.担当者.error = '担当者が複数人います';
            hasError = true;
        }

        // レコードに登録された報告内容の回数を格納
        const torokuKaisu = record.報告内容.value.length;
        // それぞれの報告内容で一つでも0以下の作業時間があればエラーを表示
        for (let i = 0; i < torokuKaisu; i++) {
            let sagyoJikan = record.報告内容.value[i].value.作業時間_分.value;
            if (sagyoJikan <= 0) {
                record.報告内容.value[i].value.作業時間_分.error = '作業時間を正しく入力してください';
                hasError = true;
            }
        }

        // 合計時間フィールドから8時間以上であればエラーが発生するよう訂正。
        if (record.合計時間.value > 8) {
            event.error = '勤務時間(8時間)を超過しています。'
            hasError = true;
        };

        if (hasError) return event;

        // 担当者のログインID
        const tantoshaCode = record.担当者.value[0].code;
        // 登録されたレコード情報に割り振られるID
        const recordId = kintone.app.record.getId();

        const shinkigamenQuery = '担当者 in ("' + tantoshaCode + '") and 作業日 = "' + sagyobi + '"';
        const henshugamenQuery = '担当者 in ("' + tantoshaCode + '") and 作業日 = "' + sagyobi + '" and $id != "' + recordId + '"';
        // 担当者と作業日が重複するデータを格納する空のオブジェクト
        let recordData = {};
        try {
            // 新規画面(レコードIDが存在しない)の場合
            if (!recordId) {
                const body = {
                    app: kintone.app.getId(),
                    // 新規登録画面の時、担当者と作業日がかぶるかどうかを確認
                    query: shinkigamenQuery,
                    fields: ['担当者', '作業日']
                }
                // 制限値を考慮しない書き方にして処理を軽くするよう修正
                recordData = await kintone.api(kintone.api.url('/k/v1/records', true), 'GET', body);
            }

            // 編集画面(レコードIDが存在する)の場合
            else {
                const body = {
                    app: kintone.app.getId(),
                    // 現在編集中のレコードは条件から外す
                    // 編集画面の場合、担当者・作業日・レコードIDをもとに検索
                    query: henshugamenQuery,
                    fields: ['担当者', '作業日']
                }
                recordData = await kintone.api(kintone.api.url('/k/v1/records', true), 'GET', body);
            }

            // 担当者、作業日が同じものが既に登録されている場合、エラー表示
            if (recordData.records.length > 0) {
                event.error = '入力情報が重複しています';
            }

        } catch (err) {
            console.log(err);
        }

        return event;

    });

})()
