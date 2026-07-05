

(async () => {
    const organization = "dttmoj";
    const project = "NajizMobile";
    const batchSize = 200;

    const url = new URL(window.location.href);
    const planId = url.searchParams.get("planId");
    const suiteId = url.searchParams.get("suiteId");

    if (!planId || !suiteId) {
        alert("PlanId or SuiteId not found in the URL.");
        return;
    }

    const personalAccessToken = prompt("Enter Azure DevOps Personal Access Token");

    if (!personalAccessToken) return;

    const auth = "Basic " + btoa(":" + personalAccessToken);

    const headers = {
        Authorization: auth,
        "Content-Type": "application/json"
    };

    try {

        alert("Loading Test Cases...");

        //---------------------------------------------------------
        // Step 1 : Get Test Cases from Suite
        //---------------------------------------------------------

        const suiteUrl =
            `https://dev.azure.com/${organization}/${project}` +
            `/_apis/test/Plans/${planId}/suites/${suiteId}/testcases?api-version=7.1`;

        const suiteResponse = await fetch(suiteUrl, {
            headers
        });

        if (!suiteResponse.ok)
            throw new Error("Failed to load test cases.");

        const suiteData = await suiteResponse.json();

        const ids = suiteData.value.map(x => Number(x.testCase.id));

        if (!ids.length) {
            alert("No Test Cases Found.");
            return;
        }

        console.log(`Found ${ids.length} Test Cases`);

        //---------------------------------------------------------
        // Step 2 : Get Work Items in batches (200 max)
        //---------------------------------------------------------

        const batchUrl =
            `https://dev.azure.com/${organization}/${project}` +
            `/_apis/wit/workitemsbatch?api-version=7.1`;

        const allWorkItems = [];

        for (let i = 0; i < ids.length; i += batchSize) {

            const currentBatch = ids.slice(i, i + batchSize);

            console.log(
                `Loading batch ${Math.floor(i / batchSize) + 1} (${currentBatch.length} items)...`
            );

            document.title =
                `Loading ${Math.min(i + batchSize, ids.length)}/${ids.length}`;

            const body = {
                ids: currentBatch,
                fields: [
                    "System.Id",
                    "System.Title",
                    "System.State",
                    "System.Tags",
                    "System.AreaPath",
                    "System.IterationPath",
                    "System.AssignedTo",
                    "System.CreatedDate",
                    "System.ChangedDate",
                    "Microsoft.VSTS.Common.Priority",
                    "Microsoft.VSTS.TCM.AutomationStatus",
                    "Microsoft.VSTS.TCM.AutomatedTestName",
                    "Microsoft.VSTS.TCM.AutomatedTestStorage",
                    "Microsoft.VSTS.TCM.AutomatedTestType"
                ]
            };

            const response = await fetch(batchUrl, {
                method: "POST",
                headers,
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(error);
            }

            const data = await response.json();

            allWorkItems.push(...data.value);

            console.log(
                `Loaded ${Math.min(i + batchSize, ids.length)} / ${ids.length}`
            );
        }

        document.title = document.title.replace(/^Loading.*?\//, "");

        //---------------------------------------------------------
        // Step 3 : Build JSON
        //---------------------------------------------------------

        const output = allWorkItems.map(tc => {

            const f = tc.fields || {};

            return {

                id: f["System.Id"],

                title: f["System.Title"],

                priority: f["Microsoft.VSTS.Common.Priority"],

                state: f["System.State"],

                tags: f["System.Tags"]
                    ? f["System.Tags"].split(";").map(t => t.trim())
                    : [],

                assignedTo:
                    f["System.AssignedTo"]?.displayName ??
                    f["System.AssignedTo"]?.uniqueName ??
                    null,

                areaPath:
                    f["System.AreaPath"],

                iterationPath:
                    f["System.IterationPath"],

                automationStatus:
                    f["Microsoft.VSTS.TCM.AutomationStatus"],

                automatedTestName:
                    f["Microsoft.VSTS.TCM.AutomatedTestName"],

                automatedTestStorage:
                    f["Microsoft.VSTS.TCM.AutomatedTestStorage"],

                automatedTestType:
                    f["Microsoft.VSTS.TCM.AutomatedTestType"],

                createdDate:
                    f["System.CreatedDate"],

                changedDate:
                    f["System.ChangedDate"],

                url:
                    `https://dev.azure.com/${organization}/${project}/_workitems/edit/${f["System.Id"]}`
            };

        });

        //---------------------------------------------------------
        // Step 4 : Download JSON
        //---------------------------------------------------------

        const blob = new Blob(
            [JSON.stringify(output, null, 2)],
            {
                type: "application/json"
            }
        );

        const downloadLink = document.createElement("a");

        downloadLink.href = URL.createObjectURL(blob);

        downloadLink.download = `TestCases_${planId}_${suiteId}.json`;

        document.body.appendChild(downloadLink);

        downloadLink.click();

        downloadLink.remove();

        URL.revokeObjectURL(downloadLink.href);

        alert(`Downloaded ${output.length} Test Cases`);

    } catch (err) {

        console.error(err);

        alert(err.message);

    }

})();