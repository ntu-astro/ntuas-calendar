const regex = /(?:^|;\s*)admin_session=([^;]*)/;
console.log("admin_session=123".match(regex)[1]);
