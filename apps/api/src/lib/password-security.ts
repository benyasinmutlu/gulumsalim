// Gerçek kullanıcı bulunmadığında da aynı maliyetli bcrypt karşılaştırmasını
// yaparak e-posta/kullanıcı adı varlığının yanıt süresinden anlaşılmasını
// zorlaştırır. Bu hash gerçek bir hesaba ait değildir ve secret değildir.
export const DUMMY_PASSWORD_HASH = "$2a$12$NLHbEyUDI52H.Pc5Q.U7oOSttZBzemPHZLVOoT1AkclRLCNur7e.W";
