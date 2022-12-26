/*
 * Copyright 2020 Nicole Borrelli
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

let flags = "";
let seed = "";

function getFilename() {
    var fullPath = document.getElementById('rom-file').value;
    if (fullPath) {
        var startIndex = (fullPath.indexOf('\\') >= 0 ? fullPath.lastIndexOf('\\') : fullPath.lastIndexOf('/'));
        var filename = fullPath.substring(startIndex);
        if (filename.indexOf('\\') === 0 || filename.indexOf('/') === 0) {
            filename = filename.substring(1);
        }
        return filename
    }
    return ""
}

function updateRom() {
    var filename = getFilename()
    if (filename != "") {
        document.getElementById("rom-button").value = filename;
        loadRom();
    } else {
        document.getElementById("rom-button").value = "Selected ROM"
    }
}

function loadRom() {
    const reader = new FileReader();
    const file = document.getElementById("rom-file").files[0];
    reader.onload = function() {
        romData = new Uint8Array(reader.result.slice(0));
    };
    reader.readAsArrayBuffer(file);
    romName = filename;
}

function randomize() {
    if (romData == null) {
        alert("Please select a ROM.");
        return;
    }

    const patchName = document.getElementsByName("challenge")[0].value;
    const parts = patchName.split("_", 2)
    flags = parts[0]
    seed = parts[1]

    var xhr = new XMLHttpRequest();
    xhr.open("GET", '/patches/patch_' + patchName + ".ips", true);

    //Send the proper header information along with the request
    xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
    xhr.responseType = "arraybuffer";
    xhr.onreadystatechange = function() { // Call a function when the state changes.
        if (this.readyState === XMLHttpRequest.DONE && this.status === 200) {
            console.log("got data: " + xhr.response);
            applyPatch(xhr.response)
        }
    }
    xhr.send();
}

function applyPatch(patchBuffer) {
    return new Promise(resolve => {
        let ipsData = new Ips(patchBuffer);
        applyPatchAsync(ipsData);
    });
}

async function applyPatchAsync(ipsData) {
    let patchedRom = Uint8Array.from(romData)
    let first = true;
    let patch = ipsData.nextPatch()
    while (patch != null) {
        for (let index = 0; index < patch.data.length; ++index) {
            patchedRom[patch.offset + index] = patch.data[index];
        }
        patch = ipsData.nextPatch();
    }

    baseFile = getFilename().replace(".gba", "")
    romName = (baseFile + "_" + flags + "_" + seed + ".gba").replace(/ /g, "-")
    console.log("output name: " + romName)
    saveData(patchedRom, romName);
}

class Ips {
    constructor(patchBuffer) {
        this.patchData = new Uint8Array(patchBuffer);

        // Check the magic
        const magic = new Uint8Array([0x50, 0x41, 0x54, 0x43, 0x48]);
        for (let magicIndex = 0; magicIndex < magic.length; ++magicIndex) {
            if (this.patchData[magicIndex] != magic[magicIndex]) {
                throw "Not an IPS file!"
            }
        }

        // Checked out! First byte of the actual patch data is next.
        this.index = magic.length;
    }

    getByte() {
        if (this.index < this.patchData.length) {
            return this.patchData[this.index++]
        }
        throw "Index out of bounds"
    }

    nextPatch() {
        let offset = (this.getByte() << 16) | (this.getByte() << 8) | this.getByte();

        if (offset == 0x454f46) {
            console.log("EOF found");
            return null;
        }

        let size = (this.getByte() << 8) | (this.getByte());
        let data = []

        if (size > 0) {
            for (let index = 0; index < size; ++index) {
                data.push(this.getByte());
            }
        } else {
            let rleSize = (this.getByte() << 8) | (this.getByte());
            let rleData = this.getByte();
            for (let index = 0; index < rleSize; ++index) {
                data.push(rleData);
            }
        }

        return {
            "offset": offset,
            "data": data
        };
    }

}

let romData = null;
let romName = null;

function loadRom() {
    const reader = new FileReader();
    const file = document.getElementById("rom-file").files[0];
    reader.onload = function() {
        romData = new Uint8Array(reader.result.slice(0));
    };
    reader.readAsArrayBuffer(file);
}

const saveData = (function() {
    var a = document.createElement("a");
    document.body.appendChild(a);
    a.style = "display: none";
    return function(data, fileName) {
        let url = window.URL.createObjectURL(new Blob([data], {
            type: "octet/stream"
        }));
        a.href = url;
        a.download = fileName;
        a.click();
        window.URL.revokeObjectURL(url);
    };
}());

