// //  //  //   //  //          GET DASHBOARD PAGE    //  //  //  //  //  //  // 

const getDashboard = async (req,res) =>{                                                    
  try{
    if(req.session.adminID) {  
    res.render('admin/dashboard')   
    }
    else{
      res.redirect('admin/login')
    }                                                              
  }catch(error){
    console.log(error);
  }
}

export default {
  getDashboard
}