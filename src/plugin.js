export default function myPlugin(k) {
    return {
        hi() {
            k.debug.log("hi");
        },
    };
}