# Image API Quickstart

Before we proceed, you need to create an [API key](https://account.topazlabs.com/manage-api).

This key will be used to authenticate your requests to the Topaz Labs API.

<details>

<summary>How do I get my API key?</summary>

In order to get access to the API, you'll need to [log into](http://topazlabs.com/account) your Topaz Labs account and create your unique API key. If you don't have an account, please follow the link [here](https://topazlabs.com/wp-login.php?action=register) to register.

<figure><img src="/files/v5A92VRBSVpzudLAXLeV" alt=""><figcaption></figcaption></figure>

1. Log into your Topaz Labs account from our [website](https://topazlabs.com/my-account/)
2. Navigate to the **API Keys** section in your account portal, enter a name, and click **Create**
3. Copy your API key (displayed at the top of the screen) and store it in a safe place

{% hint style="warning" %}
You may only view your API key on creation, so please be sure to copy the key as it will no longer be visible to you once you exit the page. If you lose your key, you may log into your account portal to manage your existing keys and generate new ones.
{% endhint %}

</details>

Now, proceed with the below steps.

{% tabs %}
{% tab title="JavaScript" %}

```javascript
npm install form-data
```

{% endtab %}

{% tab title="Python" %}

```python
pip install requests
```

{% endtab %}
{% endtabs %}

{% tabs %}
{% tab title="JavaScript" %}

```javascript
export TOPAZ_API_KEY="PASTE_YOUR_API_KEY_HERE"
```

{% endtab %}

{% tab title="Python" %}

```python
export TOPAZ_API_KEY="PASTE_YOUR_API_KEY_HERE"
```

{% endtab %}
{% endtabs %}

Now you can call our [Enhance endpoint](broken://spaces/z77V5aSS5QsChodPQbj5/pages/8d7df663a707a6b5d8ab65c5b5fe41edd74cf241) using the Topaz Labs client:

{% tabs %}
{% tab title="JavaScript" %}

```javascript
import fs from 'fs';
import FormData from 'form-data';

const API_KEY = process.env.TOPAZ_API_KEY;
const HEADERS = { 'X-API-KEY': API_KEY };
const IMAGE_BASE = 'https://api.topazlabs.com/image/v1';

// Submit the job
const form = new FormData();
form.append('model', 'Standard V2');
form.append('output_format', 'jpeg');
form.append('image', fs.createReadStream('photo.jpg'));

const response = await fetch(`${IMAGE_BASE}/enhance/async`, {
  method: 'POST',
  headers: { ...HEADERS, ...form.getHeaders() },
  body: form,
});
const { process_id } = await response.json();

// Poll for completion
let status;
do {
  await new Promise(resolve => setTimeout(resolve, 2000));
  const statusRes = await fetch(`${IMAGE_BASE}/status/${process_id}`, {
    headers: HEADERS,
  });
  ({ status } = await statusRes.json());
  console.log(`Status: ${status}`);
  if (status === 'Failed' || status === 'Cancelled') {
    throw new Error(`Job ended with status: ${status}`);
  }
} while (status !== 'Completed');

// Download the result
const downloadRes = await fetch(`${IMAGE_BASE}/download/${process_id}`, {
  headers: HEADERS,
});
const { url } = await downloadRes.json();
console.log(`Download your image: ${url}`);
```

{% endtab %}

{% tab title="Python" %}

```python
import os
import time
import requests

API_KEY = os.environ["TOPAZ_API_KEY"]
HEADERS = {"X-API-KEY": API_KEY}
IMAGE_BASE = "https://api.topazlabs.com/image/v1"

# Submit the job
response = requests.post(
    f"{IMAGE_BASE}/enhance/async",
    headers=HEADERS,
    data={
        "model": "Standard V2",
        "output_format": "jpeg"
    },
    files={"image": open("photo.jpg", "rb")}
)
process_id = response.json()["process_id"]

# Poll for completion
while True:
    status = requests.get(
        f"{IMAGE_BASE}/status/{process_id}",
        headers=HEADERS
    ).json()["status"]

    print(f"Status: {status}")
    if status == "Completed":
        break
    elif status in ("Failed", "Cancelled"):
        raise Exception(f"Job ended with status: {status}")
    time.sleep(2)

# Download the result
download_url = requests.get(
    f"{IMAGE_BASE}/download/{process_id}",
    headers=HEADERS
).json()["url"]

print(f"Download your image: {download_url}")
```

{% endtab %}
{% endtabs %}

We have now made more popular image models such as Wonder 2, Bloom Creative, and Recover 3 more available as ready-to-use APIs so that you can easily integrate them into your applications.

<table data-card-size="large" data-view="cards"><thead><tr><th align="center"></th><th data-hidden data-card-cover data-type="image">Cover image</th><th data-hidden data-card-target data-type="content-ref"></th></tr></thead><tbody><tr><td align="center">Wonder 2<br><code>Generative Image Upscaling</code></td><td></td><td><a href="/pages/HViiwPD2MYLsh3kLA7kO">/pages/HViiwPD2MYLsh3kLA7kO</a></td></tr><tr><td align="center">Bloom Creative<br><code>Creative Image Upscaling</code></td><td><a href="/files/q2n3NmocgIsHgsKHeLzN">/files/q2n3NmocgIsHgsKHeLzN</a></td><td><a href="/pages/PzZoYOpwL5VbtlsRYdJU">/pages/PzZoYOpwL5VbtlsRYdJU</a></td></tr></tbody></table>

Once you find a model that you want to use in our "Models" tab, you can grab the URL from the model's dedicated page. Individual model pages also provide some important information about the model including use cases and examples of how you can call it.

Check out our [API Playground](https://playground.topazlabs.com/) to tinker with these models and let us know your feedback and questions on our [Discord](https://discord.gg/vBCCwr28ZH).

<details>

<summary>How do I make an API call from the API Playground?</summary>

<figure><img src="/files/SOOBKXbhnxGqXypTYku3" alt=""><figcaption></figcaption></figure>

It's now easier more than ever to create and send your first API request. Once you have a Topaz Labs account and you have created your first API key, navigate over to our [API Playground](https://playground.topazlabs.com/) to better understand how to build requests. Please see the walkthrough above for an example of an image being upscaled with our Enhance Synchronous endpoint on the Image API.

</details>

### More Information

<details>

<summary>API Restrictions</summary>

* The API has access rate limits depending on the current load on the servers. If you receive a HTTP 429 response, please try again (soon). We recommend using an exponential backoff for the requests to avoid immediately hitting the limit again.
* The API only responds to HTTPS-secured communications. Any requests sent via HTTP return an HTTP 301 redirect to the corresponding HTTPS resources.
* The API enforces a request size limit of 500MB. If a request exceeds this limit, the server responds with an HTTP 413. Please ensure that requests stay within the size constraint to avoid this error.

</details>

Please reach out to <help@topazlabs.com> with any questions.
